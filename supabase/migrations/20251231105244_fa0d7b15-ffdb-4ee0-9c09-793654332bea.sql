-- Add RLS policy for health_office to view assessments in their province
CREATE POLICY "Health office can view province assessments"
ON public.assessments
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM profiles p
    JOIN hospitals h ON h.province_id = p.province_id
    WHERE p.user_id = auth.uid()
      AND p.role = 'health_office'::user_role
      AND h.id = assessments.hospital_id
  )
);

-- Add RLS policy for health_office to view assessment items
CREATE POLICY "Health office can view assessment items"
ON public.assessment_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM assessments a
    JOIN profiles p ON p.role = 'health_office'::user_role
    JOIN hospitals h ON h.province_id = p.province_id AND h.id = a.hospital_id
    WHERE a.id = assessment_items.assessment_id
      AND p.user_id = auth.uid()
  )
);

-- Add RLS policy for health_office to view qualitative scores
CREATE POLICY "Health office can view qualitative scores"
ON public.qualitative_scores
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM assessments a
    JOIN profiles p ON p.role = 'health_office'::user_role
    JOIN hospitals h ON h.province_id = p.province_id AND h.id = a.hospital_id
    WHERE a.id = qualitative_scores.assessment_id
      AND p.user_id = auth.uid()
  )
);

-- Add RLS policy for health_office to view impact scores
CREATE POLICY "Health office can view impact scores"
ON public.impact_scores
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM assessments a
    JOIN profiles p ON p.role = 'health_office'::user_role
    JOIN hospitals h ON h.province_id = p.province_id AND h.id = a.hospital_id
    WHERE a.id = impact_scores.assessment_id
      AND p.user_id = auth.uid()
  )
);