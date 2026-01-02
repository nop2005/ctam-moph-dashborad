-- Create helper function to check if user is a supervisor
CREATE OR REPLACE FUNCTION public.is_supervisor()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = 'supervisor'::public.user_role
  );
$$;

-- Update RLS policies for assessments - allow supervisor to view like regional
CREATE POLICY "Supervisor can view region assessments" 
ON public.assessments 
FOR SELECT
USING (EXISTS ( SELECT 1
   FROM ((profiles p
     JOIN provinces prov ON ((prov.health_region_id = p.health_region_id)))
     JOIN hospitals h ON ((h.province_id = prov.id)))
  WHERE ((p.user_id = auth.uid()) AND (p.role = 'supervisor'::user_role) AND (h.id = assessments.hospital_id))));

CREATE POLICY "Supervisor can view health office assessments in region" 
ON public.assessments 
FOR SELECT
USING (EXISTS ( SELECT 1
   FROM (profiles p
     JOIN health_offices ho ON ((ho.health_region_id = p.health_region_id)))
  WHERE ((p.user_id = auth.uid()) AND (p.role = 'supervisor'::user_role) AND (ho.id = assessments.health_office_id))));

-- Allow supervisor to view qualitative scores
CREATE POLICY "Supervisor can view qualitative scores" 
ON public.qualitative_scores 
FOR SELECT
USING (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = 'supervisor'::user_role))));

-- Allow supervisor to view impact scores
CREATE POLICY "Supervisor can view impact scores" 
ON public.impact_scores 
FOR SELECT
USING (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = 'supervisor'::user_role))));

-- Allow supervisor to manage inspection files like regional
CREATE POLICY "Supervisor can manage inspection files" 
ON public.inspection_files 
FOR ALL
USING (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = 'supervisor'::user_role))));

-- Allow supervisor to view supervisee inspection files
CREATE POLICY "Supervisor can view supervisee inspection files" 
ON public.supervisee_inspection_files 
FOR SELECT
USING (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.role = 'supervisor'::user_role))));