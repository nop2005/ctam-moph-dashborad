-- Create table for inspection files
CREATE TABLE public.inspection_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  province_id UUID NOT NULL REFERENCES public.provinces(id) ON DELETE CASCADE,
  health_region_id UUID NOT NULL REFERENCES public.health_regions(id) ON DELETE CASCADE,
  fiscal_year INTEGER NOT NULL,
  assessment_round TEXT NOT NULL CHECK (assessment_round IN ('รอบที่ 1', 'รอบที่ 2')),
  file_type TEXT NOT NULL CHECK (file_type IN ('report', 'slides')),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(province_id, fiscal_year, assessment_round, file_type)
);

-- Enable RLS
ALTER TABLE public.inspection_files ENABLE ROW LEVEL SECURITY;

-- Policies for inspection files
CREATE POLICY "Authenticated users can view inspection files"
ON public.inspection_files
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Regional/Provincial/Central can insert inspection files"
ON public.inspection_files
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('regional', 'provincial', 'central_admin')
  )
);

CREATE POLICY "Regional/Provincial/Central can update inspection files"
ON public.inspection_files
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('regional', 'provincial', 'central_admin')
  )
);

CREATE POLICY "Regional/Provincial/Central can delete inspection files"
ON public.inspection_files
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('regional', 'provincial', 'central_admin')
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_inspection_files_updated_at
BEFORE UPDATE ON public.inspection_files
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for inspection files
INSERT INTO storage.buckets (id, name, public) VALUES ('inspection-files', 'inspection-files', true);

-- Storage policies
CREATE POLICY "Authenticated users can view inspection files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'inspection-files' AND auth.role() = 'authenticated');

CREATE POLICY "Regional/Provincial/Central can upload inspection files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'inspection-files' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('regional', 'provincial', 'central_admin')
  )
);

CREATE POLICY "Regional/Provincial/Central can update inspection files"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'inspection-files' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('regional', 'provincial', 'central_admin')
  )
);

CREATE POLICY "Regional/Provincial/Central can delete inspection files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'inspection-files' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('regional', 'provincial', 'central_admin')
  )
);