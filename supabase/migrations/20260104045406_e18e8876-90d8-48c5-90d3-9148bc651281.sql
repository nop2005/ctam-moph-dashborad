-- Drop the overly permissive public policy that allows everyone to see all assessments
DROP POLICY IF EXISTS "Public can view all assessments for reports" ON public.assessments;

-- Drop the hospital_it policy that allows viewing same province hospitals (should only apply to reports, not assessment list)
DROP POLICY IF EXISTS "Hospital IT can view same province hospital assessments" ON public.assessments;