
-- Allow CEO to view personnel across their province (same as provincial admin)
CREATE POLICY "CEO can view personnel in province"
ON public.personnel
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = 'ceo'::user_role
      AND (
        (personnel.hospital_id IN (
          SELECT h.id FROM hospitals h WHERE h.province_id = p.province_id
        ))
        OR
        (personnel.health_office_id IN (
          SELECT ho.id FROM health_offices ho WHERE ho.province_id = p.province_id
        ))
      )
  )
);
