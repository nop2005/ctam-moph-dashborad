
-- Backfill missing scores for already-submitted assessments
WITH item_stats AS (
  SELECT
    ai.assessment_id,
    COUNT(*) FILTER (WHERE ai.status = 'pass')::numeric AS pass_count,
    COUNT(*)::numeric AS total_count
  FROM public.assessment_items ai
  GROUP BY ai.assessment_id
)
UPDATE public.assessments a
SET
  quantitative_score = CASE
    WHEN s.total_count > 0 THEN (s.pass_count / 17.0) * 7.0
    ELSE 0
  END,
  impact_score = CASE
    WHEN isc.total_score IS NULL THEN 3
    ELSE LEAST((isc.total_score / 100.0) * 3.0, 3.0)
  END,
  qualitative_score = COALESCE(a.qualitative_score, 0),
  total_score = (
    CASE
      WHEN s.total_count > 0 THEN (s.pass_count / 17.0) * 7.0
      ELSE 0
    END
  ) + (
    CASE
      WHEN isc.total_score IS NULL THEN 3
      ELSE LEAST((isc.total_score / 100.0) * 3.0, 3.0)
    END
  )
FROM item_stats s
LEFT JOIN public.impact_scores isc ON isc.assessment_id = s.assessment_id
WHERE a.id = s.assessment_id
  AND a.status IN ('submitted','approved_provincial','approved_regional','completed','returned')
  AND (a.quantitative_score IS NULL OR a.total_score IS NULL OR a.impact_score IS NULL);
