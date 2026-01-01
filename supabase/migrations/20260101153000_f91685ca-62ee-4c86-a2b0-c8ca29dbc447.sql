-- Add RLS policy for assessment_items to allow viewing health office assessment items

-- Allow health office users to view their own assessment items
CREATE POLICY "Health office can view own assessment items"
ON public.assessment_items
FOR SELECT
USING (EXISTS (
  SELECT 1
  FROM assessments a
  JOIN profiles p ON p.user_id = auth.uid()
  WHERE a.id = assessment_items.assessment_id
    AND p.role = 'health_office'::user_role
    AND p.health_office_id = a.health_office_id
));