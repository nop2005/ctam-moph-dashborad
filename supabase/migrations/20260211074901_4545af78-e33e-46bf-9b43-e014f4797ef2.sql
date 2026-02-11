-- CEO can view province assessments (same as provincial)
CREATE POLICY "CEO can view province assessments"
ON public.assessments
FOR SELECT
USING (EXISTS (
  SELECT 1
  FROM profiles p
  JOIN hospitals h ON h.province_id = p.province_id
  WHERE p.user_id = auth.uid()
    AND p.role = 'ceo'::user_role
    AND h.id = assessments.hospital_id
));

-- CEO can view region assessments for reports (same as provincial)
CREATE POLICY "CEO can view region assessments for reports"
ON public.assessments
FOR SELECT
USING (EXISTS (
  SELECT 1
  FROM profiles p
  JOIN provinces user_prov ON user_prov.id = p.province_id
  JOIN provinces target_prov ON target_prov.health_region_id = user_prov.health_region_id
  JOIN hospitals h ON h.province_id = target_prov.id
  WHERE p.user_id = auth.uid()
    AND p.role = 'ceo'::user_role
    AND h.id = assessments.hospital_id
));

-- CEO can view health office assessments in province
CREATE POLICY "CEO can view province health office assessments"
ON public.assessments
FOR SELECT
USING (EXISTS (
  SELECT 1
  FROM profiles p
  JOIN health_offices ho ON ho.province_id = p.province_id
  WHERE p.user_id = auth.uid()
    AND p.role = 'ceo'::user_role
    AND ho.id = assessments.health_office_id
));

-- CEO can view region health office assessments for reports
CREATE POLICY "CEO can view region health office assessments for reports"
ON public.assessments
FOR SELECT
USING (EXISTS (
  SELECT 1
  FROM profiles p
  JOIN provinces user_prov ON user_prov.id = p.province_id
  JOIN health_offices ho ON ho.health_region_id = user_prov.health_region_id
  WHERE p.user_id = auth.uid()
    AND p.role = 'ceo'::user_role
    AND ho.id = assessments.health_office_id
));

-- CEO can view assessment items (via assessment visibility which is already handled)
-- assessment_items follows assessment visibility so no extra policy needed

-- CEO can view qualitative scores in region (for reports)
CREATE POLICY "CEO can view region qualitative scores"
ON public.qualitative_scores
FOR SELECT
USING (EXISTS (
  SELECT 1
  FROM profiles p
  JOIN provinces user_prov ON user_prov.id = p.province_id
  JOIN provinces target_prov ON target_prov.health_region_id = user_prov.health_region_id
  JOIN hospitals h ON h.province_id = target_prov.id
  JOIN assessments a ON a.hospital_id = h.id
  WHERE p.user_id = auth.uid()
    AND p.role = 'ceo'::user_role
    AND a.id = qualitative_scores.assessment_id
));