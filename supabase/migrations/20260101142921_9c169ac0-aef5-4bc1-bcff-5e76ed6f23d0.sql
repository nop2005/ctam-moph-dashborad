-- Add health_office_id column to assessments table
ALTER TABLE public.assessments 
ADD COLUMN health_office_id uuid REFERENCES public.health_offices(id);

-- Allow health_office users to create assessments for their own health office
CREATE POLICY "Health office can create own assessments"
ON public.assessments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = 'health_office'::user_role
      AND p.health_office_id = assessments.health_office_id
  )
);

-- Allow health_office users to view their own health office assessments
CREATE POLICY "Health office can view own assessments"
ON public.assessments
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = 'health_office'::user_role
      AND p.health_office_id = assessments.health_office_id
  )
);

-- Allow health_office users to update their draft/returned assessments
CREATE POLICY "Health office can update own draft assessments"
ON public.assessments
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = 'health_office'::user_role
      AND p.health_office_id = assessments.health_office_id
  )
  AND status IN ('draft'::assessment_status, 'returned'::assessment_status)
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = 'health_office'::user_role
      AND p.health_office_id = assessments.health_office_id
  )
  AND status IN ('draft'::assessment_status, 'returned'::assessment_status, 'submitted'::assessment_status)
);

-- Allow health_office to manage their own assessment items
CREATE POLICY "Health office can manage own assessment items"
ON public.assessment_items
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM assessments a
    JOIN profiles p ON p.user_id = auth.uid()
    WHERE a.id = assessment_items.assessment_id
      AND p.role = 'health_office'::user_role
      AND p.health_office_id = a.health_office_id
  )
);

-- Allow health_office to create/manage their own qualitative scores
CREATE POLICY "Health office can create own qualitative scores"
ON public.qualitative_scores
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM assessments a
    JOIN profiles p ON p.user_id = auth.uid()
    WHERE a.id = qualitative_scores.assessment_id
      AND p.role = 'health_office'::user_role
      AND p.health_office_id = a.health_office_id
      AND a.status IN ('draft'::assessment_status, 'returned'::assessment_status)
  )
);

CREATE POLICY "Health office can update own qualitative scores"
ON public.qualitative_scores
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM assessments a
    JOIN profiles p ON p.user_id = auth.uid()
    WHERE a.id = qualitative_scores.assessment_id
      AND p.role = 'health_office'::user_role
      AND p.health_office_id = a.health_office_id
      AND a.status IN ('draft'::assessment_status, 'returned'::assessment_status)
  )
);

CREATE POLICY "Health office can delete own qualitative scores"
ON public.qualitative_scores
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM assessments a
    JOIN profiles p ON p.user_id = auth.uid()
    WHERE a.id = qualitative_scores.assessment_id
      AND p.role = 'health_office'::user_role
      AND p.health_office_id = a.health_office_id
      AND a.status IN ('draft'::assessment_status, 'returned'::assessment_status)
  )
);

-- Allow health_office to create/manage their own impact scores
CREATE POLICY "Health office can create own impact scores"
ON public.impact_scores
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM assessments a
    JOIN profiles p ON p.user_id = auth.uid()
    WHERE a.id = impact_scores.assessment_id
      AND p.role = 'health_office'::user_role
      AND p.health_office_id = a.health_office_id
      AND a.status IN ('draft'::assessment_status, 'returned'::assessment_status)
  )
);

CREATE POLICY "Health office can update own impact scores"
ON public.impact_scores
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM assessments a
    JOIN profiles p ON p.user_id = auth.uid()
    WHERE a.id = impact_scores.assessment_id
      AND p.role = 'health_office'::user_role
      AND p.health_office_id = a.health_office_id
      AND a.status IN ('draft'::assessment_status, 'returned'::assessment_status)
  )
);

CREATE POLICY "Health office can delete own impact scores"
ON public.impact_scores
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM assessments a
    JOIN profiles p ON p.user_id = auth.uid()
    WHERE a.id = impact_scores.assessment_id
      AND p.role = 'health_office'::user_role
      AND p.health_office_id = a.health_office_id
      AND a.status IN ('draft'::assessment_status, 'returned'::assessment_status)
  )
);