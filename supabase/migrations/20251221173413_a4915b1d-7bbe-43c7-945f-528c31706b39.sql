-- Create storage bucket for qualitative evidence files
INSERT INTO storage.buckets (id, name, public)
VALUES ('qualitative-evidence', 'qualitative-evidence', true)
ON CONFLICT (id) DO NOTHING;

-- Create table for qualitative evidence files
CREATE TABLE IF NOT EXISTS public.qualitative_evidence_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  qualitative_score_id UUID REFERENCES public.qualitative_scores(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL, -- e.g., 'has_ciso', 'has_dpo', etc.
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.qualitative_evidence_files ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Qualitative evidence follows assessment visibility"
ON public.qualitative_evidence_files
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM qualitative_scores qs
    JOIN assessments a ON a.id = qs.assessment_id
    WHERE qs.id = qualitative_evidence_files.qualitative_score_id
  )
);

CREATE POLICY "Hospital IT can manage own qualitative evidence"
ON public.qualitative_evidence_files
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM qualitative_scores qs
    JOIN assessments a ON a.id = qs.assessment_id
    JOIN profiles p ON p.hospital_id = a.hospital_id
    WHERE qs.id = qualitative_evidence_files.qualitative_score_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Reviewers can manage qualitative evidence"
ON public.qualitative_evidence_files
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('provincial', 'regional', 'central_admin')
  )
);

-- Storage policies for qualitative-evidence bucket
CREATE POLICY "Anyone can view qualitative evidence"
ON storage.objects FOR SELECT
USING (bucket_id = 'qualitative-evidence');

CREATE POLICY "Authenticated users can upload qualitative evidence"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'qualitative-evidence' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update own qualitative evidence"
ON storage.objects FOR UPDATE
USING (bucket_id = 'qualitative-evidence' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Authenticated users can delete own qualitative evidence"
ON storage.objects FOR DELETE
USING (bucket_id = 'qualitative-evidence' AND auth.uid()::text = (storage.foldername(name))[1]);