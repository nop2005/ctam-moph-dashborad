-- Retry: user_id is uuid, so compare directly to auth.uid()

CREATE OR REPLACE FUNCTION public.is_central_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = 'central_admin'::public.user_role
  );
$$;

DROP POLICY IF EXISTS "Central admin can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Central admin can manage profiles" ON public.profiles;

CREATE POLICY "Central admin can view all profiles"
ON public.profiles
FOR SELECT
USING (public.is_central_admin());

CREATE POLICY "Central admin can manage profiles"
ON public.profiles
FOR ALL
USING (public.is_central_admin())
WITH CHECK (public.is_central_admin());
