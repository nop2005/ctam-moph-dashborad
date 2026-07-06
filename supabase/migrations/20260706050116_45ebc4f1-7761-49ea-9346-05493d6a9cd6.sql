
-- Distinct positions from personnel in region 1
CREATE OR REPLACE FUNCTION public.search_r1_positions(p_query text DEFAULT NULL, p_limit int DEFAULT 30)
RETURNS TABLE (position_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT TRIM(p.position) AS position_name
  FROM public.personnel p
  LEFT JOIN public.hospitals h ON h.id = p.hospital_id
  LEFT JOIN public.provinces hp ON hp.id = h.province_id
  LEFT JOIN public.health_regions hr1 ON hr1.id = hp.health_region_id
  LEFT JOIN public.health_offices ho ON ho.id = p.health_office_id
  LEFT JOIN public.health_regions hr2 ON hr2.id = ho.health_region_id
  WHERE p.position IS NOT NULL
    AND LENGTH(TRIM(p.position)) > 0
    AND (hr1.region_number = 1 OR hr2.region_number = 1)
    AND (
      p_query IS NULL OR LENGTH(TRIM(p_query)) = 0
      OR p.position ILIKE '%' || p_query || '%'
    )
  ORDER BY position_name
  LIMIT GREATEST(1, LEAST(p_limit, 100));
$$;

GRANT EXECUTE ON FUNCTION public.search_r1_positions(text, int) TO anon, authenticated;

-- Hospitals + Health offices in region 1 (with linked province)
CREATE OR REPLACE FUNCTION public.search_r1_organizations(p_query text DEFAULT NULL, p_limit int DEFAULT 30)
RETURNS TABLE (
  org_id uuid,
  org_type text,
  organization text,
  province text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    h.id,
    'hospital'::text,
    h.name,
    COALESCE(pr.name, '')
  FROM public.hospitals h
  JOIN public.provinces pr ON pr.id = h.province_id
  JOIN public.health_regions hr ON hr.id = pr.health_region_id
  WHERE hr.region_number = 1
    AND (
      p_query IS NULL OR LENGTH(TRIM(p_query)) = 0
      OR h.name ILIKE '%' || p_query || '%'
      OR pr.name ILIKE '%' || p_query || '%'
    )

  UNION ALL

  SELECT
    ho.id,
    'health_office'::text,
    ho.name,
    COALESCE(pr.name, '')
  FROM public.health_offices ho
  LEFT JOIN public.provinces pr ON pr.id = ho.province_id
  JOIN public.health_regions hr ON hr.id = ho.health_region_id
  WHERE hr.region_number = 1
    AND (
      p_query IS NULL OR LENGTH(TRIM(p_query)) = 0
      OR ho.name ILIKE '%' || p_query || '%'
      OR COALESCE(pr.name,'') ILIKE '%' || p_query || '%'
    )

  ORDER BY 3
  LIMIT GREATEST(1, LEAST(p_limit, 200));
$$;

GRANT EXECUTE ON FUNCTION public.search_r1_organizations(text, int) TO anon, authenticated;
