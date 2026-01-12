-- Fix: allow Health Office users to upload/manage evidence files for their own Health Office assessments

-- 1) evidence_files table (metadata)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='evidence_files'
      AND policyname='Health office can manage own evidence files'
  ) THEN
    CREATE POLICY "Health office can manage own evidence files"
    ON public.evidence_files
    FOR ALL
    TO public
    USING (
      EXISTS (
        SELECT 1
        FROM public.assessment_items ai
        JOIN public.assessments a ON a.id = ai.assessment_id
        JOIN public.profiles p ON p.user_id = auth.uid()
        WHERE ai.id = public.evidence_files.assessment_item_id
          AND p.role = 'health_office'::public.user_role
          AND p.health_office_id = a.health_office_id
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.assessment_items ai
        JOIN public.assessments a ON a.id = ai.assessment_id
        JOIN public.profiles p ON p.user_id = auth.uid()
        WHERE ai.id = public.evidence_files.assessment_item_id
          AND p.role = 'health_office'::public.user_role
          AND p.health_office_id = a.health_office_id
      )
    );
  END IF;
END $$;

-- 2) storage.objects (actual file upload/delete in bucket evidence-files)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage'
      AND tablename='objects'
      AND policyname='Health office can upload evidence files'
  ) THEN
    CREATE POLICY "Health office can upload evidence files"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'evidence-files'
      AND EXISTS (
        SELECT 1
        FROM public.assessments a
        JOIN public.profiles p ON p.user_id = auth.uid()
        WHERE p.role = 'health_office'::public.user_role
          AND p.health_office_id = a.health_office_id
          AND (storage.foldername(name))[1] = (a.id)::text
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage'
      AND tablename='objects'
      AND policyname='Health office can delete own evidence files'
  ) THEN
    CREATE POLICY "Health office can delete own evidence files"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'evidence-files'
      AND EXISTS (
        SELECT 1
        FROM public.assessments a
        JOIN public.profiles p ON p.user_id = auth.uid()
        WHERE p.role = 'health_office'::public.user_role
          AND p.health_office_id = a.health_office_id
          AND (storage.foldername(name))[1] = (a.id)::text
      )
    );
  END IF;
END $$;