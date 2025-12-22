-- Drop the existing policy
DROP POLICY IF EXISTS "Hospital IT can update draft assessments" ON public.assessments;

-- Create new policy with proper WITH CHECK for status transitions
CREATE POLICY "Hospital IT can update draft assessments" 
ON public.assessments 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.hospital_id = assessments.hospital_id
      AND profiles.role = 'hospital_it'::user_role
  )
  AND status = ANY (ARRAY['draft'::assessment_status, 'returned'::assessment_status])
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
      AND profiles.hospital_id = assessments.hospital_id
      AND profiles.role = 'hospital_it'::user_role
  )
  AND status = ANY (ARRAY['draft'::assessment_status, 'returned'::assessment_status, 'submitted'::assessment_status])
);