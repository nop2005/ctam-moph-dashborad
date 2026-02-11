
-- RLS: CEO can view own hospital assessments
CREATE POLICY "CEO can view own hospital assessments"
ON public.assessments
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles p
  WHERE p.user_id = auth.uid()
    AND p.role = 'ceo'::user_role
    AND p.hospital_id = assessments.hospital_id
));

-- RLS: CEO can view qualitative scores
CREATE POLICY "CEO can view qualitative scores"
ON public.qualitative_scores
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles p
  WHERE p.user_id = auth.uid()
    AND p.role = 'ceo'::user_role
    AND EXISTS (
      SELECT 1 FROM assessments a
      WHERE a.id = qualitative_scores.assessment_id
        AND a.hospital_id = p.hospital_id
    )
));

-- RLS: CEO can view personnel in own hospital
CREATE POLICY "CEO can view personnel in own hospital"
ON public.personnel
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles p
  WHERE p.user_id = auth.uid()
    AND p.role = 'ceo'::user_role
    AND p.hospital_id = personnel.hospital_id
));

-- Update get_dashboard_stats to support CEO role
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_fiscal_year integer DEFAULT NULL::integer, p_user_role text DEFAULT NULL::text, p_province_id uuid DEFAULT NULL::uuid, p_health_region_id uuid DEFAULT NULL::uuid, p_hospital_id uuid DEFAULT NULL::uuid, p_health_office_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result JSON;
BEGIN
  WITH 
  assessments_filtered AS (
    SELECT 
      a.id,
      a.hospital_id,
      a.health_office_id,
      a.status,
      a.fiscal_year,
      h.province_id AS hospital_province_id,
      hp.health_region_id AS hospital_region_id,
      ho.province_id AS office_province_id,
      ho.health_region_id AS office_region_id
    FROM public.assessments a
    LEFT JOIN public.hospitals h ON h.id = a.hospital_id
    LEFT JOIN public.provinces hp ON hp.id = h.province_id
    LEFT JOIN public.health_offices ho ON ho.id = a.health_office_id
    WHERE (p_fiscal_year IS NULL OR a.fiscal_year = p_fiscal_year)
      AND (
        p_user_role = 'central_admin'
        OR (p_user_role = 'hospital_it' AND a.hospital_id = p_hospital_id)
        OR (p_user_role = 'ceo' AND a.hospital_id = p_hospital_id)
        OR (p_user_role = 'health_office' AND (
          a.health_office_id = p_health_office_id 
          OR h.province_id = p_province_id
        ))
        OR (p_user_role = 'provincial' AND (
          h.province_id = p_province_id 
          OR ho.province_id = p_province_id
        ))
        OR (p_user_role IN ('regional', 'supervisor') AND (
          hp.health_region_id = p_health_region_id 
          OR ho.health_region_id = p_health_region_id
        ))
        OR p_user_role IS NULL
      )
  )
  
  SELECT json_build_object(
    'total', COUNT(*)::integer,
    'draft', COUNT(*) FILTER (WHERE status = 'draft')::integer,
    'waitingProvincial', COUNT(*) FILTER (WHERE status = 'submitted')::integer,
    'waitingRegional', COUNT(*) FILTER (WHERE status = 'approved_provincial')::integer,
    'approved', COUNT(*) FILTER (WHERE status IN ('approved_regional', 'completed'))::integer,
    'returned', COUNT(*) FILTER (WHERE status = 'returned')::integer
  )
  INTO result
  FROM assessments_filtered;
  
  RETURN result;
END;
$function$;
