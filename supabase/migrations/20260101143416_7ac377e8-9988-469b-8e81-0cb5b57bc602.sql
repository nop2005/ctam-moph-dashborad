-- Make hospital_id nullable to support health_office assessments
ALTER TABLE public.assessments 
ALTER COLUMN hospital_id DROP NOT NULL;