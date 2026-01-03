-- Allow provincial to view assessments of other provinces in same region (for reports)
CREATE POLICY "Provincial can view region assessments for reports"
ON public.assessments
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM profiles p
    JOIN provinces user_prov ON user_prov.id = p.province_id
    JOIN provinces target_prov ON target_prov.health_region_id = user_prov.health_region_id
    JOIN hospitals h ON h.province_id = target_prov.id
    WHERE p.user_id = auth.uid()
      AND p.role = 'provincial'::user_role
      AND h.id = assessments.hospital_id
  )
);

-- Allow provincial to view health office assessments in same region (for reports)
CREATE POLICY "Provincial can view region health office assessments for reports"
ON public.assessments
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM profiles p
    JOIN provinces user_prov ON user_prov.id = p.province_id
    JOIN health_offices ho ON ho.health_region_id = user_prov.health_region_id
    WHERE p.user_id = auth.uid()
      AND p.role = 'provincial'::user_role
      AND ho.id = assessments.health_office_id
  )
);