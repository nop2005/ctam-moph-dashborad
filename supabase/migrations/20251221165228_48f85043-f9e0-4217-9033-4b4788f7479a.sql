-- Create storage bucket for evidence files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'evidence-files', 
  'evidence-files', 
  false, 
  52428800, -- 50MB limit
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for evidence files bucket
CREATE POLICY "Users can upload evidence files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'evidence-files' AND
  (storage.foldername(name))[1] IN (
    SELECT a.id::text 
    FROM assessments a
    JOIN profiles p ON p.hospital_id = a.hospital_id
    WHERE p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can view evidence files for accessible assessments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'evidence-files'
);

CREATE POLICY "Users can delete own evidence files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'evidence-files' AND
  (storage.foldername(name))[1] IN (
    SELECT a.id::text 
    FROM assessments a
    JOIN profiles p ON p.hospital_id = a.hospital_id
    WHERE p.user_id = auth.uid()
  )
);