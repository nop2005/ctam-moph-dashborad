-- CEO can view budget records in their province (same scope as provincial)
CREATE POLICY "CEO can view province budget records"
ON public.budget_records
FOR SELECT
USING (EXISTS (
  SELECT 1
  FROM profiles p
  WHERE p.user_id = auth.uid()
    AND p.role = 'ceo'::user_role
    AND (
      -- Hospital budget in same province
      (budget_records.hospital_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM hospitals h WHERE h.id = budget_records.hospital_id AND h.province_id = p.province_id
      ))
      OR
      -- Health office budget in same province
      (budget_records.health_office_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM health_offices ho WHERE ho.id = budget_records.health_office_id AND ho.province_id = p.province_id
      ))
    )
));

-- CEO can view budget records in their region (for region-level reports)
CREATE POLICY "CEO can view region budget records"
ON public.budget_records
FOR SELECT
USING (EXISTS (
  SELECT 1
  FROM profiles p
  JOIN provinces user_prov ON user_prov.id = p.province_id
  WHERE p.user_id = auth.uid()
    AND p.role = 'ceo'::user_role
    AND (
      (budget_records.hospital_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM hospitals h 
        JOIN provinces hp ON hp.id = h.province_id 
        WHERE h.id = budget_records.hospital_id AND hp.health_region_id = user_prov.health_region_id
      ))
      OR
      (budget_records.health_office_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM health_offices ho 
        WHERE ho.id = budget_records.health_office_id AND ho.health_region_id = user_prov.health_region_id
      ))
    )
));