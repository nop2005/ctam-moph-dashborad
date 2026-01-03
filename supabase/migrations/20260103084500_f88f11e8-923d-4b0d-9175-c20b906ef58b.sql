-- Add RLS policy for hospital_it to view assessments from other hospitals in the same province
-- This policy checks the report_access_policies table to see if view_same_province_hospitals is enabled

CREATE POLICY "Hospital IT can view same province hospital assessments" 
ON public.assessments 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1
    FROM profiles p
    JOIN hospitals h ON h.province_id = p.province_id
    JOIN report_access_policies rap ON rap.role = 'hospital_it' AND rap.report_type = 'overview'
    WHERE p.user_id = auth.uid()
      AND p.role = 'hospital_it'
      AND h.id = assessments.hospital_id
      AND rap.view_same_province_hospitals = true
  )
);