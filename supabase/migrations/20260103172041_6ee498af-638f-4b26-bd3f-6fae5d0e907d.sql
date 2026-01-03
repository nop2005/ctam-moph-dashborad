-- Add RLS policy to allow public (anonymous) read access to inspection_files
CREATE POLICY "Public can view inspection files" 
ON public.inspection_files 
FOR SELECT 
USING (true);