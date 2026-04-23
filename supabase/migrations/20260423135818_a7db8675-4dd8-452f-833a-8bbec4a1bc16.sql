
-- Allow hospital_it to delete their own hospital's assessments
-- Allow health_office users to delete their own office's assessments
-- Allow provincial admin to delete assessments in their province (hospitals or health offices)
-- Allow regional admin to delete assessments in their health region
-- Central admin can already delete via existing patterns; add explicit policy

CREATE POLICY "Hospital IT can delete own assessments"
ON public.assessments
FOR DELETE
TO authenticated
USING (
  hospital_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = 'hospital_it'::user_role
      AND p.hospital_id = assessments.hospital_id
  )
);

CREATE POLICY "Health office can delete own assessments"
ON public.assessments
FOR DELETE
TO authenticated
USING (
  health_office_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = 'health_office'::user_role
      AND p.health_office_id = assessments.health_office_id
  )
);

CREATE POLICY "Provincial admin can delete province assessments"
ON public.assessments
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = 'provincial'::user_role
      AND (
        (assessments.hospital_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.hospitals h WHERE h.id = assessments.hospital_id AND h.province_id = p.province_id
        ))
        OR
        (assessments.health_office_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.health_offices ho WHERE ho.id = assessments.health_office_id AND ho.province_id = p.province_id
        ))
      )
  )
);

CREATE POLICY "Regional admin can delete region assessments"
ON public.assessments
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = 'regional'::user_role
      AND (
        (assessments.hospital_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.hospitals h
          JOIN public.provinces pr ON pr.id = h.province_id
          WHERE h.id = assessments.hospital_id AND pr.health_region_id = p.health_region_id
        ))
        OR
        (assessments.health_office_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.health_offices ho
          WHERE ho.id = assessments.health_office_id AND ho.health_region_id = p.health_region_id
        ))
      )
  )
);

CREATE POLICY "Central admin can delete any assessment"
ON public.assessments
FOR DELETE
TO authenticated
USING (public.is_central_admin());
