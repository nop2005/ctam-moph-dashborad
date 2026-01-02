-- Allow regional admins to view supervisor users within their own health region

CREATE OR REPLACE FUNCTION public.can_regional_view_supervisor(_health_region_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = 'regional'::public.user_role
      AND p.health_region_id = _health_region_id
  );
$$;

-- RLS policy: regional admins can view supervisors in their region
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Regional can view supervisors in their region'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "Regional can view supervisors in their region"
      ON public.profiles
      FOR SELECT
      USING (
        role = 'supervisor'::public.user_role
        AND public.can_regional_view_supervisor(health_region_id)
      );
    $pol$;
  END IF;
END $$;