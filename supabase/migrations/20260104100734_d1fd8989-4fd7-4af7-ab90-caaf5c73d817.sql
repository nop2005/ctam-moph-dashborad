-- Allow hospital_it users to view all assessments for reporting purposes
CREATE POLICY "Hospital IT can view all assessments for reports"
ON public.assessments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'hospital_it'::user_role
  )
);

-- Allow health_office users to view all assessments for reporting purposes
CREATE POLICY "Health office can view all assessments for reports"
ON public.assessments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'health_office'::user_role
  )
);