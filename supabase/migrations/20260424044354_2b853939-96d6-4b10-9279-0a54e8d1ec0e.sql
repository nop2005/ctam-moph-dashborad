
-- Helper: ตรวจสอบว่า regional admin อยู่ในเขตที่ดูแล assessment นี้หรือไม่
CREATE OR REPLACE FUNCTION public.is_regional_admin_for_assessment(_assessment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.assessments a
    LEFT JOIN public.hospitals h ON h.id = a.hospital_id
    LEFT JOIN public.provinces p_h ON p_h.id = h.province_id
    LEFT JOIN public.health_offices ho ON ho.id = a.health_office_id
    JOIN public.profiles prof ON prof.user_id = auth.uid()
    WHERE a.id = _assessment_id
      AND prof.role = 'regional'::user_role
      AND prof.health_region_id IS NOT NULL
      AND prof.health_region_id = COALESCE(p_h.health_region_id, ho.health_region_id)
  );
$$;

-- Allow regional admin to UPDATE assessments in their region (any status)
DROP POLICY IF EXISTS "Regional can edit any assessment in region" ON public.assessments;
CREATE POLICY "Regional can edit any assessment in region"
ON public.assessments
FOR UPDATE
USING (public.is_regional_admin_for_assessment(id))
WITH CHECK (public.is_regional_admin_for_assessment(id));

-- assessment_items: regional admin can SELECT/INSERT/UPDATE/DELETE for assessments in their region
DROP POLICY IF EXISTS "Regional can manage items in region" ON public.assessment_items;
CREATE POLICY "Regional can manage items in region"
ON public.assessment_items
FOR ALL
USING (public.is_regional_admin_for_assessment(assessment_id))
WITH CHECK (public.is_regional_admin_for_assessment(assessment_id));

-- impact_scores
DROP POLICY IF EXISTS "Regional can manage impact scores in region" ON public.impact_scores;
CREATE POLICY "Regional can manage impact scores in region"
ON public.impact_scores
FOR ALL
USING (public.is_regional_admin_for_assessment(assessment_id))
WITH CHECK (public.is_regional_admin_for_assessment(assessment_id));

-- qualitative_scores
DROP POLICY IF EXISTS "Regional can manage qualitative scores in region" ON public.qualitative_scores;
CREATE POLICY "Regional can manage qualitative scores in region"
ON public.qualitative_scores
FOR ALL
USING (public.is_regional_admin_for_assessment(assessment_id))
WITH CHECK (public.is_regional_admin_for_assessment(assessment_id));

-- evidence_files: linked through assessment_items
CREATE OR REPLACE FUNCTION public.is_regional_admin_for_assessment_item(_item_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_regional_admin_for_assessment(
    (SELECT assessment_id FROM public.assessment_items WHERE id = _item_id)
  );
$$;

DROP POLICY IF EXISTS "Regional can manage evidence files in region" ON public.evidence_files;
CREATE POLICY "Regional can manage evidence files in region"
ON public.evidence_files
FOR ALL
USING (public.is_regional_admin_for_assessment_item(assessment_item_id))
WITH CHECK (public.is_regional_admin_for_assessment_item(assessment_item_id));

-- impact_evidence_files: linked through impact_scores
CREATE OR REPLACE FUNCTION public.is_regional_admin_for_impact_score(_impact_score_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_regional_admin_for_assessment(
    (SELECT assessment_id FROM public.impact_scores WHERE id = _impact_score_id)
  );
$$;

DROP POLICY IF EXISTS "Regional can manage impact evidence files in region" ON public.impact_evidence_files;
CREATE POLICY "Regional can manage impact evidence files in region"
ON public.impact_evidence_files
FOR ALL
USING (impact_score_id IS NOT NULL AND public.is_regional_admin_for_impact_score(impact_score_id))
WITH CHECK (impact_score_id IS NOT NULL AND public.is_regional_admin_for_impact_score(impact_score_id));
