-- Update cache TTL from 5 minutes to 20 minutes in get_internal_report_summary
CREATE OR REPLACE FUNCTION public.get_internal_report_summary(p_fiscal_year integer DEFAULT NULL::integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result JSON;
  cached_result JSONB;
  cache_age INTERVAL;
  cache_key_val TEXT;
BEGIN
  cache_key_val := 'internal_summary_' || COALESCE(p_fiscal_year::text, 'all');
  
  SELECT payload, (NOW() - generated_at)
  INTO cached_result, cache_age
  FROM public.internal_report_cache
  WHERE cache_key = cache_key_val;
  
  -- Changed from 5 minutes to 20 minutes
  IF cached_result IS NOT NULL AND cache_age < INTERVAL '20 minutes' THEN
    RETURN cached_result::json;
  END IF;

  WITH 
  regions AS (SELECT id, name, region_number FROM public.health_regions ORDER BY region_number),
  provinces_data AS (SELECT id, name, health_region_id FROM public.provinces ORDER BY name),
  hospitals_data AS (
    SELECT h.id, h.name, h.code, h.province_id, p.health_region_id
    FROM public.hospitals h JOIN public.provinces p ON p.id = h.province_id ORDER BY h.name
  ),
  health_offices_data AS (SELECT id, name, code, province_id, health_region_id, office_type FROM public.health_offices ORDER BY name),
  all_units AS (
    SELECT 'hospital' AS unit_type, h.id AS unit_id, h.province_id, h.health_region_id FROM hospitals_data h
    UNION ALL
    SELECT 'health_office', ho.id, ho.province_id, ho.health_region_id FROM health_offices_data ho
  ),
  unit_counts_region AS (SELECT health_region_id, COUNT(*)::int AS total_units FROM all_units GROUP BY health_region_id),
  unit_counts_province AS (SELECT province_id, COUNT(*)::int AS total_units FROM all_units WHERE province_id IS NOT NULL GROUP BY province_id),
  assessments_with_units AS (
    SELECT a.id AS assessment_id, a.hospital_id, a.health_office_id, COALESCE(a.hospital_id, a.health_office_id) AS unit_id,
      a.fiscal_year, a.assessment_period, a.status, a.total_score, a.quantitative_score, a.qualitative_score, a.impact_score, a.created_at,
      COALESCE(h.health_region_id, ho.health_region_id) AS health_region_id, COALESCE(h.province_id, ho.province_id) AS province_id
    FROM public.assessments a
    LEFT JOIN hospitals_data h ON h.id = a.hospital_id
    LEFT JOIN health_offices_data ho ON ho.id = a.health_office_id
    WHERE (p_fiscal_year IS NULL OR a.fiscal_year = p_fiscal_year)
  ),
  latest_per_unit AS (
    SELECT * FROM (SELECT awu.*, ROW_NUMBER() OVER (PARTITION BY awu.unit_id ORDER BY awu.fiscal_year DESC, 
      CASE WHEN awu.assessment_period ~ '^\d+$' THEN awu.assessment_period::int ELSE 0 END DESC, awu.created_at DESC) AS rn
    FROM assessments_with_units awu) ranked WHERE rn = 1
  ),
  region_stats_agg AS (
    SELECT health_region_id,
      COUNT(DISTINCT CASE WHEN status != 'draft' THEN unit_id END)::int AS with_assessment,
      COUNT(DISTINCT CASE WHEN status IN ('approved_regional', 'completed') THEN unit_id END)::int AS completed,
      COUNT(DISTINCT CASE WHEN status IN ('submitted', 'approved_provincial') THEN unit_id END)::int AS pending
    FROM assessments_with_units GROUP BY health_region_id
  ),
  province_stats_agg AS (
    SELECT province_id,
      COUNT(DISTINCT CASE WHEN status != 'draft' THEN unit_id END)::int AS with_assessment,
      COUNT(DISTINCT CASE WHEN status IN ('approved_regional', 'completed') THEN unit_id END)::int AS completed,
      COUNT(DISTINCT CASE WHEN status IN ('submitted', 'approved_provincial') THEN unit_id END)::int AS pending
    FROM assessments_with_units WHERE province_id IS NOT NULL GROUP BY province_id
  ),
  fiscal_years_data AS (SELECT DISTINCT fiscal_year FROM public.assessments WHERE fiscal_year IS NOT NULL ORDER BY fiscal_year DESC)
  
  SELECT json_build_object(
    'health_regions', (SELECT COALESCE(json_agg(row_to_json(r.*) ORDER BY r.region_number), '[]'::json) FROM regions r),
    'provinces', (SELECT COALESCE(json_agg(row_to_json(p.*) ORDER BY p.name), '[]'::json) FROM provinces_data p),
    'hospitals', (SELECT COALESCE(json_agg(row_to_json(h.*) ORDER BY h.name), '[]'::json) FROM hospitals_data h),
    'health_offices', (SELECT COALESCE(json_agg(row_to_json(ho.*) ORDER BY ho.name), '[]'::json) FROM health_offices_data ho),
    'region_stats', (
      SELECT COALESCE(json_agg(json_build_object('id', r.id, 'name', r.name, 'region_number', r.region_number,
        'total_units', COALESCE(ucr.total_units, 0), 'with_assessment', COALESCE(rsa.with_assessment, 0),
        'completed', COALESCE(rsa.completed, 0), 'pending', COALESCE(rsa.pending, 0)) ORDER BY r.region_number), '[]'::json)
      FROM regions r LEFT JOIN unit_counts_region ucr ON ucr.health_region_id = r.id LEFT JOIN region_stats_agg rsa ON rsa.health_region_id = r.id
    ),
    'province_stats', (
      SELECT COALESCE(json_agg(json_build_object('id', p.id, 'name', p.name, 'health_region_id', p.health_region_id,
        'total_units', COALESCE(ucp.total_units, 0), 'with_assessment', COALESCE(psa.with_assessment, 0),
        'completed', COALESCE(psa.completed, 0), 'pending', COALESCE(psa.pending, 0)) ORDER BY p.name), '[]'::json)
      FROM provinces_data p LEFT JOIN unit_counts_province ucp ON ucp.province_id = p.id LEFT JOIN province_stats_agg psa ON psa.province_id = p.id
    ),
    'assessments', (
      SELECT COALESCE(json_agg(json_build_object('id', assessment_id, 'hospital_id', hospital_id, 'health_office_id', health_office_id,
        'status', status, 'fiscal_year', fiscal_year, 'assessment_period', assessment_period, 'total_score', total_score,
        'quantitative_score', quantitative_score, 'impact_score', impact_score, 'created_at', created_at,
        'health_region_id', health_region_id, 'province_id', province_id) ORDER BY created_at DESC), '[]'::json)
      FROM latest_per_unit
    ),
    'fiscal_years', (SELECT COALESCE(json_agg(fiscal_year), '[]'::json) FROM fiscal_years_data)
  ) INTO result;
  
  INSERT INTO public.internal_report_cache (cache_key, fiscal_year, payload, generated_at)
  VALUES (cache_key_val, p_fiscal_year, result::jsonb, NOW())
  ON CONFLICT (cache_key) DO UPDATE SET payload = EXCLUDED.payload, generated_at = EXCLUDED.generated_at;
  
  RETURN result;
END;
$function$;