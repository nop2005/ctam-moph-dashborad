-- Add policy for regional users to manage pending provincial users in their region
-- First, create a helper function to check if regional can manage pending provincial
CREATE OR REPLACE FUNCTION public.can_regional_manage_pending_provincial(_province_id uuid)
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

-- Add policy for regional to view pending provincial profiles
CREATE POLICY "Regional can view pending provincial in their region"
ON public.profiles
FOR SELECT
USING (
  role = 'provincial'::user_role 
  AND is_active = false 
  AND can_regional_manage_pending_provincial(province_id)
);

-- Add policy for regional to approve (update) pending provincial users
CREATE POLICY "Regional can approve pending provincial in their region"
ON public.profiles
FOR UPDATE
USING (
  role = 'provincial'::user_role 
  AND is_active = false 
  AND can_regional_manage_pending_provincial(province_id)
);