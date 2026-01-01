-- Regional admin: view health_office assessments in their health region
CREATE POLICY "Regional can view health office assessments in region"
ON public.assessments
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM profiles p
    JOIN health_offices ho ON ho.health_region_id = p.health_region_id
    WHERE p.user_id = auth.uid()
      AND p.role = 'regional'::user_role
      AND ho.id = assessments.health_office_id
  )
);

-- Regional admin: update health_office assessments after provincial approval
CREATE POLICY "Regional can update provincial-approved health office assessments"
ON public.assessments
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM profiles p
    JOIN health_offices ho ON ho.health_region_id = p.health_region_id
    WHERE p.user_id = auth.uid()
      AND p.role = 'regional'::user_role
      AND ho.id = assessments.health_office_id
  )
  AND status = 'approved_provincial'::assessment_status
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles p
    JOIN health_offices ho ON ho.health_region_id = p.health_region_id
    WHERE p.user_id = auth.uid()
      AND p.role = 'regional'::user_role
      AND ho.id = assessments.health_office_id
  )
  AND status = ANY (ARRAY['approved_provincial'::assessment_status, 'approved_regional'::assessment_status, 'returned'::assessment_status])
);