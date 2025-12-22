-- Add section-level approval tracking columns
ALTER TABLE public.assessments 
ADD COLUMN quantitative_approved_by uuid REFERENCES public.profiles(id),
ADD COLUMN quantitative_approved_at timestamp with time zone,
ADD COLUMN qualitative_approved_by uuid REFERENCES public.profiles(id),
ADD COLUMN qualitative_approved_at timestamp with time zone,
ADD COLUMN impact_approved_by uuid REFERENCES public.profiles(id),
ADD COLUMN impact_approved_at timestamp with time zone;