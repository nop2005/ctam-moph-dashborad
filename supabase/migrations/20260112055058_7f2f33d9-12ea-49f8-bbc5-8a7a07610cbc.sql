-- Performance fix: Add indexes to speed up RLS policy queries on evidence_files

-- Index 1: evidence_files by assessment_item_id (main lookup key)
CREATE INDEX IF NOT EXISTS idx_evidence_files_assessment_item_id 
ON public.evidence_files (assessment_item_id);

-- Index 2: assessment_items by assessment_id and category_id
CREATE INDEX IF NOT EXISTS idx_assessment_items_assessment_id 
ON public.assessment_items (assessment_id);

-- Index 3: assessments by hospital_id
CREATE INDEX IF NOT EXISTS idx_assessments_hospital_id 
ON public.assessments (hospital_id) WHERE hospital_id IS NOT NULL;

-- Index 4: assessments by health_office_id
CREATE INDEX IF NOT EXISTS idx_assessments_health_office_id 
ON public.assessments (health_office_id) WHERE health_office_id IS NOT NULL;

-- Index 5: profiles by user_id (main auth lookup)
CREATE INDEX IF NOT EXISTS idx_profiles_user_id 
ON public.profiles (user_id);

-- Index 6: profiles by health_office_id for RLS
CREATE INDEX IF NOT EXISTS idx_profiles_health_office_id 
ON public.profiles (health_office_id) WHERE health_office_id IS NOT NULL;

-- Index 7: profiles by hospital_id for RLS
CREATE INDEX IF NOT EXISTS idx_profiles_hospital_id 
ON public.profiles (hospital_id) WHERE hospital_id IS NOT NULL;

-- Drop slow RLS policy and recreate with simpler approach
DROP POLICY IF EXISTS "Health office can manage own evidence files" ON public.evidence_files;

-- Recreate with optimized query using EXISTS with indexed columns
CREATE POLICY "Health office can manage own evidence files"
ON public.evidence_files
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = 'health_office'::public.user_role
      AND EXISTS (
        SELECT 1
        FROM public.assessment_items ai
        JOIN public.assessments a ON a.id = ai.assessment_id
        WHERE ai.id = evidence_files.assessment_item_id
          AND a.health_office_id = p.health_office_id
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = 'health_office'::public.user_role
      AND EXISTS (
        SELECT 1
        FROM public.assessment_items ai
        JOIN public.assessments a ON a.id = ai.assessment_id
        WHERE ai.id = evidence_files.assessment_item_id
          AND a.health_office_id = p.health_office_id
      )
  )
);