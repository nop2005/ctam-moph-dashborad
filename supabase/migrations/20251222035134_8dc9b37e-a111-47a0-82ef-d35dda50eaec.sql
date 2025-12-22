-- Create helper function for provincial admin to manage hospital_it users in their province
CREATE OR REPLACE FUNCTION public.can_provincial_manage_hospital_user(_hospital_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.hospitals h ON h.province_id = p.province_id
    WHERE p.user_id = auth.uid()
      AND p.role = 'provincial'::user_role
      AND h.id = _hospital_id
  );
$$;

-- Create helper function for regional admin to manage provincial users in their health region
CREATE OR REPLACE FUNCTION public.can_regional_manage_provincial_user(_province_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.provinces prov ON prov.health_region_id = p.health_region_id
    WHERE p.user_id = auth.uid()
      AND p.role = 'regional'::user_role
      AND prov.id = _province_id
  );
$$;

-- Create helper function to check if user is provincial admin
CREATE OR REPLACE FUNCTION public.is_provincial_admin()
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
      AND p.role = 'provincial'::user_role
  );
$$;

-- Create helper function to check if user is regional admin
CREATE OR REPLACE FUNCTION public.is_regional_admin()
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
      AND p.role = 'regional'::user_role
  );
$$;

-- RLS policies for provincial admin to manage hospital_it users
CREATE POLICY "Provincial can view hospital IT in their province"
ON public.profiles
FOR SELECT
USING (
  role = 'hospital_it'::user_role
  AND can_provincial_manage_hospital_user(hospital_id)
);

CREATE POLICY "Provincial can update hospital IT in their province"
ON public.profiles
FOR UPDATE
USING (
  role = 'hospital_it'::user_role
  AND can_provincial_manage_hospital_user(hospital_id)
);

-- RLS policies for regional admin to manage provincial users
CREATE POLICY "Regional can view provincial in their region"
ON public.profiles
FOR SELECT
USING (
  role = 'provincial'::user_role
  AND can_regional_manage_provincial_user(province_id)
);

CREATE POLICY "Regional can update provincial in their region"
ON public.profiles
FOR UPDATE
USING (
  role = 'provincial'::user_role
  AND can_regional_manage_provincial_user(province_id)
);