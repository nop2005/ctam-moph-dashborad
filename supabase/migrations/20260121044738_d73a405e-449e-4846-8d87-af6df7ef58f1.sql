-- Create personnel table for staff members
CREATE TABLE public.personnel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  hospital_id UUID REFERENCES public.hospitals(id),
  health_office_id UUID REFERENCES public.health_offices(id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  position TEXT,
  phone TEXT,
  start_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create certificates table
CREATE TABLE public.personnel_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id UUID REFERENCES public.personnel(id) ON DELETE CASCADE NOT NULL,
  certificate_name TEXT NOT NULL,
  issue_date DATE,
  file_path TEXT,
  file_name TEXT,
  file_size INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.personnel ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personnel_certificates ENABLE ROW LEVEL SECURITY;

-- RLS policies for personnel
CREATE POLICY "Users can view personnel in their organization"
ON public.personnel FOR SELECT
USING (
  (hospital_id IS NOT NULL AND hospital_id IN (
    SELECT hospital_id FROM public.profiles WHERE user_id = auth.uid()
  ))
  OR
  (health_office_id IS NOT NULL AND health_office_id IN (
    SELECT health_office_id FROM public.profiles WHERE user_id = auth.uid()
  ))
  OR
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('central_admin', 'regional', 'provincial', 'supervisor'))
);

CREATE POLICY "Users can insert personnel in their organization"
ON public.personnel FOR INSERT
WITH CHECK (
  (hospital_id IS NOT NULL AND hospital_id IN (
    SELECT hospital_id FROM public.profiles WHERE user_id = auth.uid()
  ))
  OR
  (health_office_id IS NOT NULL AND health_office_id IN (
    SELECT health_office_id FROM public.profiles WHERE user_id = auth.uid()
  ))
);

CREATE POLICY "Users can update personnel in their organization"
ON public.personnel FOR UPDATE
USING (
  (hospital_id IS NOT NULL AND hospital_id IN (
    SELECT hospital_id FROM public.profiles WHERE user_id = auth.uid()
  ))
  OR
  (health_office_id IS NOT NULL AND health_office_id IN (
    SELECT health_office_id FROM public.profiles WHERE user_id = auth.uid()
  ))
);

CREATE POLICY "Users can delete personnel in their organization"
ON public.personnel FOR DELETE
USING (
  (hospital_id IS NOT NULL AND hospital_id IN (
    SELECT hospital_id FROM public.profiles WHERE user_id = auth.uid()
  ))
  OR
  (health_office_id IS NOT NULL AND health_office_id IN (
    SELECT health_office_id FROM public.profiles WHERE user_id = auth.uid()
  ))
);

-- RLS policies for certificates
CREATE POLICY "Users can view certificates of visible personnel"
ON public.personnel_certificates FOR SELECT
USING (
  personnel_id IN (SELECT id FROM public.personnel)
);

CREATE POLICY "Users can insert certificates for their personnel"
ON public.personnel_certificates FOR INSERT
WITH CHECK (
  personnel_id IN (
    SELECT id FROM public.personnel WHERE 
      (hospital_id IN (SELECT hospital_id FROM public.profiles WHERE user_id = auth.uid()))
      OR
      (health_office_id IN (SELECT health_office_id FROM public.profiles WHERE user_id = auth.uid()))
  )
);

CREATE POLICY "Users can update certificates for their personnel"
ON public.personnel_certificates FOR UPDATE
USING (
  personnel_id IN (
    SELECT id FROM public.personnel WHERE 
      (hospital_id IN (SELECT hospital_id FROM public.profiles WHERE user_id = auth.uid()))
      OR
      (health_office_id IN (SELECT health_office_id FROM public.profiles WHERE user_id = auth.uid()))
  )
);

CREATE POLICY "Users can delete certificates for their personnel"
ON public.personnel_certificates FOR DELETE
USING (
  personnel_id IN (
    SELECT id FROM public.personnel WHERE 
      (hospital_id IN (SELECT hospital_id FROM public.profiles WHERE user_id = auth.uid()))
      OR
      (health_office_id IN (SELECT health_office_id FROM public.profiles WHERE user_id = auth.uid()))
  )
);

-- Create storage bucket for certificate files
INSERT INTO storage.buckets (id, name, public) VALUES ('certificates', 'certificates', false);

-- Storage policies
CREATE POLICY "Users can upload certificates"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'certificates' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can view certificates"
ON storage.objects FOR SELECT
USING (bucket_id = 'certificates' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete certificates"
ON storage.objects FOR DELETE
USING (bucket_id = 'certificates' AND auth.uid() IS NOT NULL);

-- Create updated_at trigger
CREATE TRIGGER update_personnel_updated_at
BEFORE UPDATE ON public.personnel
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();