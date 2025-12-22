-- Drop the old policy that's too restrictive
DROP POLICY IF EXISTS "Regional can update provincial-approved assessments" ON public.assessments;

-- Create new policy with proper WITH CHECK for regional
CREATE POLICY "Regional can update provincial-approved assessments" 
ON public.assessments 
FOR UPDATE 
USING (
  (EXISTS ( 
    SELECT 1
    FROM profiles p
    JOIN provinces prov ON prov.health_region_id = p.health_region_id
    JOIN hospitals h ON h.province_id = prov.id
    WHERE p.user_id = auth.uid() 
      AND p.role = 'regional'::user_role 
      AND h.id = assessments.hospital_id
  )) 
  AND status = 'approved_provincial'::assessment_status
)
WITH CHECK (
  (EXISTS ( 
    SELECT 1
    FROM profiles p
    JOIN provinces prov ON prov.health_region_id = p.health_region_id
    JOIN hospitals h ON h.province_id = prov.id
    WHERE p.user_id = auth.uid() 
      AND p.role = 'regional'::user_role 
      AND h.id = assessments.hospital_id
  ))
  AND status IN ('approved_provincial'::assessment_status, 'approved_regional'::assessment_status)
);