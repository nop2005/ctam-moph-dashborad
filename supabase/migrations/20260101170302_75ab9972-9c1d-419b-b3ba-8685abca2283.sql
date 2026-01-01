-- Create table for supervisee inspection files (separate from supervisor)
CREATE TABLE public.supervisee_inspection_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  province_id UUID NOT NULL REFERENCES public.provinces(id),
  health_region_id UUID NOT NULL REFERENCES public.health_regions(id),
  fiscal_year INTEGER NOT NULL,
  assessment_round TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.supervisee_inspection_files ENABLE ROW LEVEL SECURITY;

-- Policies for supervisee inspection files
CREATE POLICY "Authenticated users can view supervisee inspection files"
ON public.supervisee_inspection_files
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Hospital IT/Health Office/Provincial can insert own files"
ON public.supervisee_inspection_files
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid()
    AND p.role IN ('hospital_it', 'health_office', 'provincial')
  )
);

CREATE POLICY "Hospital IT/Health Office/Provincial can update own files"
ON public.supervisee_inspection_files
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid()
    AND p.role IN ('hospital_it', 'health_office', 'provincial')
  )
);

CREATE POLICY "Hospital IT/Health Office/Provincial can delete own files"
ON public.supervisee_inspection_files
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid()
    AND p.role IN ('hospital_it', 'health_office', 'provincial')
  )
);

-- Central admin and regional can manage all
CREATE POLICY "Regional/Central can manage supervisee files"
ON public.supervisee_inspection_files
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = auth.uid()
    AND p.role IN ('regional', 'central_admin')
  )
);

-- Create storage bucket for supervisee files
INSERT INTO storage.buckets (id, name, public)
VALUES ('supervisee-inspection-files', 'supervisee-inspection-files', true);

-- Storage policies for supervisee-inspection-files bucket
CREATE POLICY "Authenticated users can view supervisee inspection files"
ON storage.objects FOR SELECT
USING (bucket_id = 'supervisee-inspection-files' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can upload supervisee inspection files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'supervisee-inspection-files' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update supervisee inspection files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'supervisee-inspection-files' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete supervisee inspection files"
ON storage.objects FOR DELETE
USING (bucket_id = 'supervisee-inspection-files' AND auth.role() = 'authenticated');