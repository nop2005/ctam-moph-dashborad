-- Policy: Provincial can view budget records in their province
CREATE POLICY "Provincial can view province budget records"
  ON public.budget_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
        AND p.role = 'provincial'::user_role
        AND (
          budget_records.hospital_id IN (
            SELECT h.id FROM hospitals h WHERE h.province_id = p.province_id
          )
          OR budget_records.health_office_id IN (
            SELECT ho.id FROM health_offices ho WHERE ho.province_id = p.province_id
          )
        )
    )
  );

-- Policy: Regional can view budget records in their region
CREATE POLICY "Regional can view region budget records"
  ON public.budget_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN provinces prov ON prov.health_region_id = p.health_region_id
      WHERE p.user_id = auth.uid()
        AND p.role = 'regional'::user_role
        AND (
          budget_records.hospital_id IN (
            SELECT h.id FROM hospitals h WHERE h.province_id = prov.id
          )
          OR budget_records.health_office_id IN (
            SELECT ho.id FROM health_offices ho WHERE ho.health_region_id = p.health_region_id
          )
        )
    )
  );

-- Policy: Central admin can view all budget records
CREATE POLICY "Central admin can view all budget records"
  ON public.budget_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
        AND p.role = 'central_admin'::user_role
    )
  );

-- Policy: Supervisor can view budget records in their region
CREATE POLICY "Supervisor can view region budget records"
  ON public.budget_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN provinces prov ON prov.health_region_id = p.health_region_id
      WHERE p.user_id = auth.uid()
        AND p.role = 'supervisor'::user_role
        AND (
          budget_records.hospital_id IN (
            SELECT h.id FROM hospitals h WHERE h.province_id = prov.id
          )
          OR budget_records.health_office_id IN (
            SELECT ho.id FROM health_offices ho WHERE ho.health_region_id = p.health_region_id
          )
        )
    )
  );