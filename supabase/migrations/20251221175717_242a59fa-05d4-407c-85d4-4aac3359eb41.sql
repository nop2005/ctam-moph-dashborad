-- Allow Hospital IT users to create/update/delete qualitative scores for their own hospital assessments (draft/returned)
CREATE POLICY "Hospital IT can create own qualitative scores"
ON public.qualitative_scores
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.assessments a
    JOIN public.profiles p ON p.hospital_id = a.hospital_id
    WHERE a.id = qualitative_scores.assessment_id
      AND p.user_id = auth.uid()
      AND p.role = 'hospital_it'::public.user_role
      AND a.status = ANY (ARRAY['draft'::public.assessment_status, 'returned'::public.assessment_status])
  )
);

CREATE POLICY "Hospital IT can update own qualitative scores"
ON public.qualitative_scores
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.assessments a
    JOIN public.profiles p ON p.hospital_id = a.hospital_id
    WHERE a.id = qualitative_scores.assessment_id
      AND p.user_id = auth.uid()
      AND p.role = 'hospital_it'::public.user_role
      AND a.status = ANY (ARRAY['draft'::public.assessment_status, 'returned'::public.assessment_status])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.assessments a
    JOIN public.profiles p ON p.hospital_id = a.hospital_id
    WHERE a.id = qualitative_scores.assessment_id
      AND p.user_id = auth.uid()
      AND p.role = 'hospital_it'::public.user_role
      AND a.status = ANY (ARRAY['draft'::public.assessment_status, 'returned'::public.assessment_status])
  )
);

CREATE POLICY "Hospital IT can delete own qualitative scores"
ON public.qualitative_scores
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.assessments a
    JOIN public.profiles p ON p.hospital_id = a.hospital_id
    WHERE a.id = qualitative_scores.assessment_id
      AND p.user_id = auth.uid()
      AND p.role = 'hospital_it'::public.user_role
      AND a.status = ANY (ARRAY['draft'::public.assessment_status, 'returned'::public.assessment_status])
  )
);

-- Allow Hospital IT users to create/update/delete impact scores for their own hospital assessments (draft/returned)
CREATE POLICY "Hospital IT can create own impact scores"
ON public.impact_scores
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.assessments a
    JOIN public.profiles p ON p.hospital_id = a.hospital_id
    WHERE a.id = impact_scores.assessment_id
      AND p.user_id = auth.uid()
      AND p.role = 'hospital_it'::public.user_role
      AND a.status = ANY (ARRAY['draft'::public.assessment_status, 'returned'::public.assessment_status])
  )
);

CREATE POLICY "Hospital IT can update own impact scores"
ON public.impact_scores
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.assessments a
    JOIN public.profiles p ON p.hospital_id = a.hospital_id
    WHERE a.id = impact_scores.assessment_id
      AND p.user_id = auth.uid()
      AND p.role = 'hospital_it'::public.user_role
      AND a.status = ANY (ARRAY['draft'::public.assessment_status, 'returned'::public.assessment_status])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.assessments a
    JOIN public.profiles p ON p.hospital_id = a.hospital_id
    WHERE a.id = impact_scores.assessment_id
      AND p.user_id = auth.uid()
      AND p.role = 'hospital_it'::public.user_role
      AND a.status = ANY (ARRAY['draft'::public.assessment_status, 'returned'::public.assessment_status])
  )
);

CREATE POLICY "Hospital IT can delete own impact scores"
ON public.impact_scores
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.assessments a
    JOIN public.profiles p ON p.hospital_id = a.hospital_id
    WHERE a.id = impact_scores.assessment_id
      AND p.user_id = auth.uid()
      AND p.role = 'hospital_it'::public.user_role
      AND a.status = ANY (ARRAY['draft'::public.assessment_status, 'returned'::public.assessment_status])
  )
);
