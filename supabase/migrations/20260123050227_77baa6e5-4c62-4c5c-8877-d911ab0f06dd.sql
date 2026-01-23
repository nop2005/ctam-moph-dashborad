-- Drop existing policies that need to be updated
DROP POLICY IF EXISTS "Provincial can update submitted assessments" ON public.assessments;
DROP POLICY IF EXISTS "Provincial can update submitted health office assessments" ON public.assessments;

-- Create new policy that allows provincial admin to update assessments with status: submitted, approved_provincial, approved_regional, completed
-- This enables the "return for revision" feature for provincial admins
CREATE POLICY "Provincial can update hospital assessments" 
ON public.assessments 
FOR UPDATE 
USING (
  (EXISTS ( 
    SELECT 1 FROM profiles p
    JOIN hospitals h ON h.province_id = p.province_id
    WHERE p.user_id = auth.uid() 
    AND p.role = 'provincial'::user_role 
    AND h.id = assessments.hospital_id
  )) 
  AND status IN ('submitted'::assessment_status, 'approved_provincial'::assessment_status, 'approved_regional'::assessment_status, 'completed'::assessment_status)
)
WITH CHECK (
  (EXISTS ( 
    SELECT 1 FROM profiles p
    JOIN hospitals h ON h.province_id = p.province_id
    WHERE p.user_id = auth.uid() 
    AND p.role = 'provincial'::user_role 
    AND h.id = assessments.hospital_id
  )) 
  AND status IN ('submitted'::assessment_status, 'approved_provincial'::assessment_status, 'approved_regional'::assessment_status, 'returned'::assessment_status, 'completed'::assessment_status)
);

-- Create new policy for health office assessments 
CREATE POLICY "Provincial can update health office assessments" 
ON public.assessments 
FOR UPDATE 
USING (
  (EXISTS ( 
    SELECT 1 FROM profiles p
    JOIN health_offices ho ON ho.province_id = p.province_id
    WHERE p.user_id = auth.uid() 
    AND p.role = 'provincial'::user_role 
    AND ho.id = assessments.health_office_id
  )) 
  AND status IN ('submitted'::assessment_status, 'approved_provincial'::assessment_status, 'approved_regional'::assessment_status, 'completed'::assessment_status)
)
WITH CHECK (
  (EXISTS ( 
    SELECT 1 FROM profiles p
    JOIN health_offices ho ON ho.province_id = p.province_id
    WHERE p.user_id = auth.uid() 
    AND p.role = 'provincial'::user_role 
    AND ho.id = assessments.health_office_id
  )) 
  AND status IN ('submitted'::assessment_status, 'approved_provincial'::assessment_status, 'approved_regional'::assessment_status, 'returned'::assessment_status, 'completed'::assessment_status)
);