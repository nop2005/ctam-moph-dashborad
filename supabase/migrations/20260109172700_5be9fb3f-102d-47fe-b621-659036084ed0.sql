-- Allow provincial to view health_office users in their province
CREATE POLICY "Provincial can view health office users in their province"
ON public.profiles
FOR SELECT
USING (
  (role = 'health_office'::user_role) AND 
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid()
    AND p.role = 'provincial'::user_role
    AND p.province_id = profiles.province_id
  )
);

-- Allow provincial to approve/update health_office users in their province
CREATE POLICY "Provincial can update health office users in their province"
ON public.profiles
FOR UPDATE
USING (
  (role = 'health_office'::user_role) AND 
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid()
    AND p.role = 'provincial'::user_role
    AND p.province_id = profiles.province_id
  )
);