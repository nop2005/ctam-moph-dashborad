-- Drop existing RLS policies for supervisee_inspection_files that allow hospital_it and health_office
DROP POLICY IF EXISTS "Hospital IT/Health Office/Provincial can insert own files" ON public.supervisee_inspection_files;
DROP POLICY IF EXISTS "Hospital IT/Health Office/Provincial can update own files" ON public.supervisee_inspection_files;
DROP POLICY IF EXISTS "Hospital IT/Health Office/Provincial can delete own files" ON public.supervisee_inspection_files;

-- Create new RLS policy: Provincial can only insert for their own province
CREATE POLICY "Provincial can insert files for own province"
ON public.supervisee_inspection_files
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = 'provincial'::user_role
      AND p.province_id = supervisee_inspection_files.province_id
  )
);

-- Create new RLS policy: Provincial can only update for their own province
CREATE POLICY "Provincial can update files for own province"
ON public.supervisee_inspection_files
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = 'provincial'::user_role
      AND p.province_id = supervisee_inspection_files.province_id
  )
);

-- Create new RLS policy: Provincial can only delete for their own province
CREATE POLICY "Provincial can delete files for own province"
ON public.supervisee_inspection_files
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = 'provincial'::user_role
      AND p.province_id = supervisee_inspection_files.province_id
  )
);