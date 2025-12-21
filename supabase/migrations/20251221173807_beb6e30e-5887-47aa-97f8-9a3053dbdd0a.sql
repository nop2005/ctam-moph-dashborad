-- Create storage bucket for impact evidence files
INSERT INTO storage.buckets (id, name, public)
VALUES ('impact-evidence', 'impact-evidence', true)
ON CONFLICT (id) DO NOTHING;

-- Create table for impact evidence files
CREATE TABLE IF NOT EXISTS public.impact_evidence_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  impact_score_id UUID REFERENCES public.impact_scores(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.impact_evidence_files ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Impact evidence follows assessment visibility"
ON public.impact_evidence_files
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM impact_scores isc
    JOIN assessments a ON a.id = isc.assessment_id
    WHERE isc.id = impact_evidence_files.impact_score_id
  )
);

CREATE POLICY "Hospital IT can manage own impact evidence"
ON public.impact_evidence_files
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM impact_scores isc
    JOIN assessments a ON a.id = isc.assessment_id
    JOIN profiles p ON p.hospital_id = a.hospital_id
    WHERE isc.id = impact_evidence_files.impact_score_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Reviewers can manage impact evidence"
ON public.impact_evidence_files
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('provincial', 'regional', 'central_admin')
  )
);

-- Storage policies for impact-evidence bucket
CREATE POLICY "Anyone can view impact evidence"
ON storage.objects FOR SELECT
USING (bucket_id = 'impact-evidence');

CREATE POLICY "Authenticated users can upload impact evidence"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'impact-evidence' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update own impact evidence"
ON storage.objects FOR UPDATE
USING (bucket_id = 'impact-evidence' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Authenticated users can delete own impact evidence"
ON storage.objects FOR DELETE
USING (bucket_id = 'impact-evidence' AND auth.uid()::text = (storage.foldername(name))[1]);