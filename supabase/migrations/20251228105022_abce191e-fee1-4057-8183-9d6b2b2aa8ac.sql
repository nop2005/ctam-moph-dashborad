-- Drop existing provincial update policy
DROP POLICY IF EXISTS "Provincial can update submitted assessments" ON assessments;

-- Create new policy that allows provincial to update from submitted to approved_provincial
CREATE POLICY "Provincial can update submitted assessments" 
ON assessments 
FOR UPDATE 
USING (
  (EXISTS (
    SELECT 1
    FROM profiles p
    JOIN hospitals h ON h.province_id = p.province_id
    WHERE p.user_id = auth.uid()
      AND p.role = 'provincial'
      AND h.id = assessments.hospital_id
  )) AND status = 'submitted'
)
WITH CHECK (
  (EXISTS (
    SELECT 1
    FROM profiles p
    JOIN hospitals h ON h.province_id = p.province_id
    WHERE p.user_id = auth.uid()
      AND p.role = 'provincial'
      AND h.id = assessments.hospital_id
  )) AND status IN ('submitted', 'approved_provincial', 'returned')
);