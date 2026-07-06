
CREATE OR REPLACE FUNCTION public.search_event_personnel_r1(p_query text DEFAULT NULL, p_limit int DEFAULT 30)
RETURNS TABLE (
  personnel_id uuid,
  full_name text,
  position_name text,
  organization text,
  province text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    TRIM(CONCAT_WS(' ', NULLIF(p.title_prefix,''), p.first_name, p.last_name)),
    COALESCE(p.position, ''),
    COALESCE(h.name, ho.name, ''),
    COALESCE(hp.name, hop.name, '')
  FROM public.personnel p
  LEFT JOIN public.hospitals h ON h.id = p.hospital_id
  LEFT JOIN public.provinces hp ON hp.id = h.province_id
  LEFT JOIN public.health_regions hr1 ON hr1.id = hp.health_region_id
  LEFT JOIN public.health_offices ho ON ho.id = p.health_office_id
  LEFT JOIN public.provinces hop ON hop.id = ho.province_id
  LEFT JOIN public.health_regions hr2 ON hr2.id = ho.health_region_id
  WHERE EXISTS (SELECT 1 FROM public.personnel_certificates pc WHERE pc.personnel_id = p.id)
    AND (hr1.region_number = 1 OR hr2.region_number = 1)
    AND (
      p_query IS NULL OR LENGTH(TRIM(p_query)) = 0
      OR p.first_name ILIKE '%' || p_query || '%'
      OR p.last_name ILIKE '%' || p_query || '%'
      OR COALESCE(p.position,'') ILIKE '%' || p_query || '%'
      OR COALESCE(h.name, ho.name, '') ILIKE '%' || p_query || '%'
    )
  ORDER BY p.first_name, p.last_name
  LIMIT GREATEST(1, LEAST(p_limit, 100));
$$;

GRANT EXECUTE ON FUNCTION public.search_event_personnel_r1(text, int) TO anon, authenticated;
