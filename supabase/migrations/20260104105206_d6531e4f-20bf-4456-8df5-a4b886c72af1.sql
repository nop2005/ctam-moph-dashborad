-- Add data_updated column to assessments table for tracking update status
ALTER TABLE public.assessments 
ADD COLUMN data_updated boolean NOT NULL DEFAULT false;