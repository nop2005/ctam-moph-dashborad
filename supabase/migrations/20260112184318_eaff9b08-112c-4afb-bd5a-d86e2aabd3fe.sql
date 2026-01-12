-- Performance indexes to reduce statement timeouts

-- profiles lookups during login/session
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles (user_id);

-- assessment_items frequent joins/filters
CREATE INDEX IF NOT EXISTS idx_assessment_items_assessment_id ON public.assessment_items (assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_items_category_id ON public.assessment_items (category_id);

-- evidence_files fetch by item + per-user operations
CREATE INDEX IF NOT EXISTS idx_evidence_files_assessment_item_id ON public.evidence_files (assessment_item_id);
CREATE INDEX IF NOT EXISTS idx_evidence_files_uploaded_by ON public.evidence_files (uploaded_by);

-- assessments filtering by year/unit/status
CREATE INDEX IF NOT EXISTS idx_assessments_fiscal_year ON public.assessments (fiscal_year);
CREATE INDEX IF NOT EXISTS idx_assessments_hospital_id ON public.assessments (hospital_id);
CREATE INDEX IF NOT EXISTS idx_assessments_health_office_id ON public.assessments (health_office_id);
CREATE INDEX IF NOT EXISTS idx_assessments_status ON public.assessments (status);

-- inspection_files reporting filters
CREATE INDEX IF NOT EXISTS idx_inspection_files_fiscal_year ON public.inspection_files (fiscal_year);
CREATE INDEX IF NOT EXISTS idx_inspection_files_region ON public.inspection_files (health_region_id);
CREATE INDEX IF NOT EXISTS idx_inspection_files_province ON public.inspection_files (province_id);
CREATE INDEX IF NOT EXISTS idx_inspection_files_round ON public.inspection_files (assessment_round);

-- Composite indexes for common filtered queries
CREATE INDEX IF NOT EXISTS idx_inspection_files_year_region ON public.inspection_files (fiscal_year, health_region_id);
CREATE INDEX IF NOT EXISTS idx_inspection_files_year_province ON public.inspection_files (fiscal_year, province_id);
