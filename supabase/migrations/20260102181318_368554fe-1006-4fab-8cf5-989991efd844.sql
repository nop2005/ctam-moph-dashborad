-- Create report_access_policies table
CREATE TABLE public.report_access_policies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  role TEXT NOT NULL,
  report_type TEXT NOT NULL,
  view_region BOOLEAN DEFAULT true,
  drill_to_province TEXT DEFAULT 'all',
  drill_to_hospital TEXT DEFAULT 'all',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(role, report_type)
);

-- Enable RLS
ALTER TABLE public.report_access_policies ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view policies
CREATE POLICY "All authenticated can view policies"
ON public.report_access_policies
FOR SELECT
TO authenticated
USING (true);

-- Central admin can manage policies
CREATE POLICY "Central admin can manage policies"
ON public.report_access_policies
FOR ALL
TO authenticated
USING (is_central_admin())
WITH CHECK (is_central_admin());

-- Add trigger for updated_at
CREATE TRIGGER update_report_access_policies_updated_at
BEFORE UPDATE ON public.report_access_policies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default policies
INSERT INTO public.report_access_policies (role, report_type, view_region, drill_to_province, drill_to_hospital) VALUES
-- hospital_it
('hospital_it', 'overview', true, 'own_region', 'own_province'),
('hospital_it', 'quantitative', true, 'own_region', 'own_province'),
('hospital_it', 'impact', true, 'own_region', 'own_province'),
-- health_office
('health_office', 'overview', true, 'own_region', 'own_province'),
('health_office', 'quantitative', true, 'own_region', 'own_province'),
('health_office', 'impact', true, 'own_region', 'own_province'),
-- provincial
('provincial', 'overview', true, 'all', 'all'),
('provincial', 'quantitative', true, 'all', 'all'),
('provincial', 'impact', true, 'all', 'all'),
-- regional
('regional', 'overview', true, 'all', 'all'),
('regional', 'quantitative', true, 'all', 'all'),
('regional', 'impact', true, 'all', 'all'),
-- central_admin
('central_admin', 'overview', true, 'all', 'all'),
('central_admin', 'quantitative', true, 'all', 'all'),
('central_admin', 'impact', true, 'all', 'all'),
-- supervisor
('supervisor', 'overview', true, 'all', 'all'),
('supervisor', 'quantitative', true, 'all', 'all'),
('supervisor', 'impact', true, 'all', 'all');