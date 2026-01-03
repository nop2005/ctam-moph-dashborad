-- Add RLS policy for public to view inspection manual files
CREATE POLICY "Public can view manual files"
ON public.inspection_manual_files
FOR SELECT
USING (true);