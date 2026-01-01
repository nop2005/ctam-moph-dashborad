-- Add RLS policy for provincial to view health_office assessments in their province
CREATE POLICY "Provincial can view health office assessments in province" 
ON public.assessments 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1
    FROM profiles p
    JOIN health_offices ho ON ho.province_id = p.province_id
    WHERE p.user_id = auth.uid()
      AND p.role = 'provincial'::user_role
      AND ho.id = assessments.health_office_id
  )
);

-- Add RLS policy for provincial to update submitted health_office assessments
CREATE POLICY "Provincial can update submitted health office assessments" 
ON public.assessments 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1
    FROM profiles p
    JOIN health_offices ho ON ho.province_id = p.province_id
    WHERE p.user_id = auth.uid()
      AND p.role = 'provincial'::user_role
      AND ho.id = assessments.health_office_id
  )
  AND status = 'submitted'::assessment_status
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles p
    JOIN health_offices ho ON ho.province_id = p.province_id
    WHERE p.user_id = auth.uid()
      AND p.role = 'provincial'::user_role
      AND ho.id = assessments.health_office_id
  )
  AND status = ANY (ARRAY['submitted'::assessment_status, 'approved_provincial'::assessment_status, 'returned'::assessment_status])
);