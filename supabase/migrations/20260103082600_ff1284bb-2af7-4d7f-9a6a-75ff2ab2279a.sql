-- Add column for viewing other hospitals in same province
ALTER TABLE public.report_access_policies 
ADD COLUMN IF NOT EXISTS view_same_province_hospitals boolean DEFAULT false;

-- Update existing policies with sensible defaults
-- hospital_it: default false (only see own hospital)
-- health_office: default true (can see all hospitals in province)
-- provincial and above: default true

UPDATE public.report_access_policies 
SET view_same_province_hospitals = false 
WHERE role = 'hospital_it';

UPDATE public.report_access_policies 
SET view_same_province_hospitals = true 
WHERE role IN ('health_office', 'provincial', 'regional', 'central_admin', 'supervisor');