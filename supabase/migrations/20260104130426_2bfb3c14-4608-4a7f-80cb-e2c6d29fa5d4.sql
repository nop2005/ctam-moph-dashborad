CREATE OR REPLACE FUNCTION public.get_public_quantitative_summary(p_fiscal_year integer DEFAULT NULL)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
WITH
  categories AS (
    SELECT id FROM public.ctam_categories
  ),
  cat_count AS (
    SELECT COUNT(*)::int AS n FROM categories
  ),
  unit_passed_all AS (
    -- Hospitals
    SELECT
      'hospital'::text AS unit_type,
      a.hospital_id AS unit_id,
      h.province_id AS province_id,
      p.health_region_id AS health_region_id
    FROM public.assessments a
    JOIN public.hospitals h ON h.id = a.hospital_id
    JOIN public.provinces p ON p.id = h.province_id
    JOIN public.assessment_items ai ON ai.assessment_id = a.id
    WHERE a.hospital_id IS NOT NULL
      AND (p_fiscal_year IS NULL OR a.fiscal_year = p_fiscal_year)
      AND ai.score = 1
    GROUP BY a.hospital_id, h.province_id, p.health_region_id
    HAVING COUNT(DISTINCT ai.category_id) = (SELECT n FROM cat_count)

    UNION ALL

    -- Health offices
    SELECT
      'health_office'::text AS unit_type,
      a.health_office_id AS unit_id,
      ho.province_id AS province_id,
      ho.health_region_id AS health_region_id
    FROM public.assessments a
    JOIN public.health_offices ho ON ho.id = a.health_office_id
    JOIN public.assessment_items ai ON ai.assessment_id = a.id
    WHERE a.health_office_id IS NOT NULL
      AND (p_fiscal_year IS NULL OR a.fiscal_year = p_fiscal_year)
      AND ai.score = 1
    GROUP BY a.health_office_id, ho.province_id, ho.health_region_id
    HAVING COUNT(DISTINCT ai.category_id) = (SELECT n FROM cat_count)
  ),
  region_passed AS (
    SELECT health_region_id, COUNT(*)::int AS passed_all_17
    FROM unit_passed_all
    GROUP BY health_region_id
  ),
  province_passed AS (
    SELECT province_id, COUNT(*)::int AS passed_all_17
    FROM unit_passed_all
    WHERE province_id IS NOT NULL
    GROUP BY province_id
  ),
  assessment_scope AS (
    SELECT
      p.health_region_id,
      h.province_id,
      a.quantitative_score::numeric AS quantitative_score
    FROM public.assessments a
    JOIN public.hospitals h ON h.id = a.hospital_id
    JOIN public.provinces p ON p.id = h.province_id
    WHERE a.hospital_id IS NOT NULL
      AND (p_fiscal_year IS NULL OR a.fiscal_year = p_fiscal_year)

    UNION ALL

    SELECT
      ho.health_region_id,
      ho.province_id,
      a.quantitative_score::numeric AS quantitative_score
    FROM public.assessments a
    JOIN public.health_offices ho ON ho.id = a.health_office_id
    WHERE a.health_office_id IS NOT NULL
      AND ho.province_id IS NOT NULL
      AND (p_fiscal_year IS NULL OR a.fiscal_year = p_fiscal_year)
  ),
  province_avg_quant AS (
    SELECT province_id, AVG(quantitative_score)::numeric AS avg_quantitative_score
    FROM assessment_scope
    WHERE quantitative_score IS NOT NULL
      AND province_id IS NOT NULL
    GROUP BY province_id
  ),
  fiscal_years AS (
    SELECT DISTINCT fiscal_year
    FROM public.assessments
    ORDER BY fiscal_year DESC
  )
SELECT jsonb_build_object(
  'fiscal_years', COALESCE((SELECT jsonb_agg(fiscal_year) FROM fiscal_years), '[]'::jsonb),
  'region_passed_all_17', COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'health_region_id', health_region_id,
          'passed_all_17', passed_all_17
        )
      )
      FROM region_passed
    ),
    '[]'::jsonb
  ),
  'province_passed_all_17', COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'province_id', province_id,
          'passed_all_17', passed_all_17
        )
      )
      FROM province_passed
    ),
    '[]'::jsonb
  ),
  'province_avg_quantitative_score', COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'province_id', province_id,
          'avg_quantitative_score', avg_quantitative_score
        )
      )
      FROM province_avg_quant
    ),
    '[]'::jsonb
  )
)::json;
$$;