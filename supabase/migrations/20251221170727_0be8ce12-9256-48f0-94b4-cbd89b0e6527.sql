-- Add policy for central_admin to view all profiles
CREATE POLICY "Central admin can view all profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'central_admin'
  )
);