-- Drop the problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Provincial can view health office users in their province" ON public.profiles;
DROP POLICY IF EXISTS "Provincial can update health office users in their province" ON public.profiles;

-- Create a helper function to check if current user is provincial for a specific province
CREATE OR REPLACE FUNCTION public.is_provincial_for_province(check_province_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid()
    AND p.role = 'provincial'::user_role
    AND p.province_id = check_province_id
  );
$$;

-- Recreate policies using the helper function to avoid recursion
CREATE POLICY "Provincial can view health office users in their province"
ON public.profiles
FOR SELECT
USING (
  (role = 'health_office'::user_role) AND 
  is_provincial_for_province(province_id)
);

CREATE POLICY "Provincial can update health office users in their province"
ON public.profiles
FOR UPDATE
USING (
  (role = 'health_office'::user_role) AND 
  is_provincial_for_province(province_id)
);