-- Fix: Change function volatility from STABLE to VOLATILE to allow INSERT for caching
CREATE OR REPLACE FUNCTION public.get_public_report_summary(p_fiscal_year integer DEFAULT NULL::integer)
RETURNS json
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result JSON;
  cached_result JSONB;
  cache_age INTERVAL;
  cache_key INT;
BEGIN
  -- Use 0 as cache key for "all years" query
  cache_key := COALESCE(p_fiscal_year, 0);
  
  -- Check cache first (valid for 10 minutes)
  SELECT payload, (NOW() - generated_at)
  INTO cached_result, cache_age
  FROM public.public_report_cache
  WHERE fiscal_year = cache_key;
  
  IF cached_result IS NOT NULL AND cache_age < INTERVAL '10 minutes' THEN
    RETURN cached_result::json;
  END IF;

  -- Calculate fresh data using CTEs (much more efficient)
  WITH 
  -- All units (hospitals + health offices) with their region/province
  all_units AS (
    SELECT 
      'hospital' AS unit_type,
      h.id AS unit_id,
      h.province_id,
      p.health_region_id
    FROM public.hospitals h
    JOIN public.provinces p ON p.id = h.province_id
    
    UNION ALL
    
    SELECT 
      'health_office' AS unit_type,
      ho.id AS unit_id,
      ho.province_id,
      ho.health_region_id
    FROM public.health_offices ho
  ),
  
  -- Count total units per region and province
  unit_counts_region AS (
    SELECT health_region_id, COUNT(*)::integer AS total_units
    FROM all_units
    GROUP BY health_region_id
  ),
  unit_counts_province AS (
    SELECT province_id, COUNT(*)::integer AS total_units
    FROM all_units
    WHERE province_id IS NOT NULL
    GROUP BY province_id
  ),
  
  -- All assessments with unit info (filtered by fiscal year if provided)
  assessments_with_units AS (
    SELECT 
      a.id AS assessment_id,
      a.hospital_id,
      a.health_office_id,
      COALESCE(a.hospital_id, a.health_office_id) AS unit_id,
      a.fiscal_year,
      a.assessment_period,
      a.status,
      a.total_score,
      a.quantitative_score,
      a.impact_score,
      a.created_at,
      COALESCE(hp.health_region_id, ho.health_region_id) AS health_region_id,
      COALESCE(h.province_id, ho.province_id) AS province_id
    FROM public.assessments a
    LEFT JOIN public.hospitals h ON h.id = a.hospital_id
    LEFT JOIN public.provinces hp ON hp.id = h.province_id
    LEFT JOIN public.health_offices ho ON ho.id = a.health_office_id
    WHERE (p_fiscal_year IS NULL OR a.fiscal_year = p_fiscal_year)
  ),
  
  -- Latest assessment per unit (using window function instead of subquery)
  latest_per_unit AS (
    SELECT *
    FROM (
      SELECT 
        awu.*,
        ROW_NUMBER() OVER (
          PARTITION BY awu.unit_id 
          ORDER BY awu.fiscal_year DESC, 
            CASE WHEN awu.assessment_period ~ '^\d+$' THEN awu.assessment_period::int ELSE 0 END DESC,
            awu.created_at DESC
        ) AS rn
      FROM assessments_with_units awu
    ) ranked
    WHERE rn = 1
  ),
  
  -- Aggregate counts per region
  region_stats_agg AS (
    SELECT 
      health_region_id,
      COUNT(DISTINCT CASE WHEN status != 'draft' THEN unit_id END)::integer AS with_assessment,
      COUNT(DISTINCT CASE WHEN status IN ('approved_regional', 'completed') THEN unit_id END)::integer AS completed,
      COUNT(DISTINCT CASE WHEN status IN ('submitted', 'approved_provincial') THEN unit_id END)::integer AS pending
    FROM assessments_with_units
    GROUP BY health_region_id
  ),
  
  -- Average scores per region (from latest assessments only)
  region_scores AS (
    SELECT 
      health_region_id,
      COALESCE(AVG(total_score), 0) AS avg_score,
      COALESCE(AVG(impact_score), 0) AS avg_qualitative_score,
      COALESCE(AVG(quantitative_score), 0) AS avg_quantitative_score
    FROM latest_per_unit
    WHERE total_score IS NOT NULL OR impact_score IS NOT NULL OR quantitative_score IS NOT NULL
    GROUP BY health_region_id
  ),
  
  -- Aggregate counts per province
  province_stats_agg AS (
    SELECT 
      province_id,
      COUNT(DISTINCT CASE WHEN status != 'draft' THEN unit_id END)::integer AS with_assessment,
      COUNT(DISTINCT CASE WHEN status IN ('approved_regional', 'completed') THEN unit_id END)::integer AS completed,
      COUNT(DISTINCT CASE WHEN status IN ('submitted', 'approved_provincial') THEN unit_id END)::integer AS pending
    FROM assessments_with_units
    WHERE province_id IS NOT NULL
    GROUP BY province_id
  ),
  
  -- Average scores per province (from latest assessments only)
  province_scores AS (
    SELECT 
      province_id,
      COALESCE(AVG(total_score), 0) AS avg_score,
      COALESCE(AVG(impact_score), 0) AS avg_qualitative_score,
      COALESCE(AVG(quantitative_score), 0) AS avg_quantitative_score
    FROM latest_per_unit
    WHERE province_id IS NOT NULL
      AND (total_score IS NOT NULL OR impact_score IS NOT NULL OR quantitative_score IS NOT NULL)
    GROUP BY province_id
  )
  
  SELECT json_build_object(
    'health_regions', (
      SELECT COALESCE(json_agg(row_to_json(r.*) ORDER BY r.region_number), '[]'::json)
      FROM public.health_regions r
    ),
    'provinces', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', p.id,
        'name', p.name,
        'health_region_id', p.health_region_id
      ) ORDER BY p.name), '[]'::json)
      FROM public.provinces p
    ),
    'region_stats', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', hr.id,
        'name', hr.name,
        'region_number', hr.region_number,
        'total_units', COALESCE(ucr.total_units, 0),
        'with_assessment', COALESCE(rsa.with_assessment, 0),
        'completed', COALESCE(rsa.completed, 0),
        'pending', COALESCE(rsa.pending, 0),
        'avg_score', COALESCE(rs.avg_score, 0),
        'avg_qualitative_score', COALESCE(rs.avg_qualitative_score, 0),
        'avg_quantitative_score', COALESCE(rs.avg_quantitative_score, 0)
      ) ORDER BY hr.region_number), '[]'::json)
      FROM public.health_regions hr
      LEFT JOIN unit_counts_region ucr ON ucr.health_region_id = hr.id
      LEFT JOIN region_stats_agg rsa ON rsa.health_region_id = hr.id
      LEFT JOIN region_scores rs ON rs.health_region_id = hr.id
    ),
    'province_stats', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', p.id,
        'name', p.name,
        'health_region_id', p.health_region_id,
        'total_units', COALESCE(ucp.total_units, 0),
        'with_assessment', COALESCE(psa.with_assessment, 0),
        'completed', COALESCE(psa.completed, 0),
        'pending', COALESCE(psa.pending, 0),
        'avg_score', COALESCE(ps.avg_score, 0),
        'avg_qualitative_score', COALESCE(ps.avg_qualitative_score, 0),
        'avg_quantitative_score', COALESCE(ps.avg_quantitative_score, 0)
      ) ORDER BY p.name), '[]'::json)
      FROM public.provinces p
      LEFT JOIN unit_counts_province ucp ON ucp.province_id = p.id
      LEFT JOIN province_stats_agg psa ON psa.province_id = p.id
      LEFT JOIN province_scores ps ON ps.province_id = p.id
    ),
    'fiscal_years', (
      SELECT COALESCE(json_agg(DISTINCT a.fiscal_year ORDER BY a.fiscal_year DESC), '[]'::json)
      FROM public.assessments a
      WHERE a.fiscal_year IS NOT NULL
    )
  ) INTO result;
  
  -- Update cache (upsert)
  INSERT INTO public.public_report_cache (fiscal_year, payload, generated_at)
  VALUES (cache_key, result::jsonb, NOW())
  ON CONFLICT (fiscal_year) 
  DO UPDATE SET payload = EXCLUDED.payload, generated_at = EXCLUDED.generated_at;
  
  RETURN result;
END;
$function$;