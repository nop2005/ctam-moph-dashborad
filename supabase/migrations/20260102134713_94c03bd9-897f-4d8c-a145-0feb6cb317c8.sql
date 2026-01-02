-- Drop and recreate Central admin view policy as PERMISSIVE
DROP POLICY IF EXISTS "Central admin can view all profiles" ON public.profiles;

CREATE POLICY "Central admin can view all profiles"
ON public.profiles
FOR SELECT
USING (is_central_admin());

-- Also need to ensure Central admin can manage all profiles is PERMISSIVE
DROP POLICY IF EXISTS "Central admin can manage profiles" ON public.profiles;

CREATE POLICY "Central admin can manage profiles"
ON public.profiles
FOR ALL
USING (is_central_admin())
WITH CHECK (is_central_admin());