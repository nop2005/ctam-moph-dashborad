-- Create health offices table
CREATE TABLE public.health_offices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  province_id UUID REFERENCES public.provinces(id),
  health_region_id UUID NOT NULL REFERENCES public.health_regions(id),
  office_type TEXT NOT NULL DEFAULT 'สำนักงานสาธารณสุขจังหวัด',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.health_offices ENABLE ROW LEVEL SECURITY;

-- RLS policies for health_offices
CREATE POLICY "Health offices are viewable by all authenticated users"
ON public.health_offices
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Central admin can manage health offices"
ON public.health_offices
FOR ALL
USING (is_central_admin());

-- Add health_office_id to profiles
ALTER TABLE public.profiles ADD COLUMN health_office_id UUID REFERENCES public.health_offices(id);

-- Create trigger for updated_at
CREATE TRIGGER update_health_offices_updated_at
BEFORE UPDATE ON public.health_offices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();