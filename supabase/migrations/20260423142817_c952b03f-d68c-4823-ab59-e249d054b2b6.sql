-- Clean up stale section approval fields for assessments that already advanced past provincial/regional level.
-- Symptom: provincial/regional approval flow advanced status but didn't clear section approval fields,
-- because checkAllSectionsApproved required the unused qualitative section.
UPDATE public.assessments
SET
  quantitative_approved_by = NULL,
  quantitative_approved_at = NULL,
  qualitative_approved_by = NULL,
  qualitative_approved_at = NULL,
  impact_approved_by = NULL,
  impact_approved_at = NULL
WHERE status IN ('approved_provincial', 'approved_regional', 'completed')
  AND (quantitative_approved_by IS NOT NULL OR impact_approved_by IS NOT NULL OR qualitative_approved_by IS NOT NULL);