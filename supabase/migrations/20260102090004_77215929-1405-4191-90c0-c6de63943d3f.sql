-- Add pinned column to inspection_manual_files table
ALTER TABLE public.inspection_manual_files 
ADD COLUMN pinned boolean NOT NULL DEFAULT false;

-- Add index for sorting pinned items first
CREATE INDEX idx_inspection_manual_files_pinned ON public.inspection_manual_files (pinned DESC, updated_at DESC);