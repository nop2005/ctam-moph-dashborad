-- Create budget_records table for annual budget recording
CREATE TABLE public.budget_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hospital_id UUID REFERENCES public.hospitals(id) ON DELETE CASCADE,
  health_office_id UUID REFERENCES public.health_offices(id) ON DELETE CASCADE,
  fiscal_year INTEGER NOT NULL,
  category_id UUID NOT NULL REFERENCES public.ctam_categories(id),
  budget_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  
  -- Ensure record belongs to either hospital OR health office, not both
  CONSTRAINT budget_hospital_or_office CHECK (
    (hospital_id IS NOT NULL AND health_office_id IS NULL) OR
    (hospital_id IS NULL AND health_office_id IS NOT NULL)
  ),
  -- Unique constraint per hospital/year/category
  CONSTRAINT unique_budget_hospital UNIQUE (hospital_id, fiscal_year, category_id),
  -- Unique constraint per health_office/year/category
  CONSTRAINT unique_budget_health_office UNIQUE (health_office_id, fiscal_year, category_id)
);

-- Create index for faster queries
CREATE INDEX idx_budget_records_hospital ON public.budget_records(hospital_id, fiscal_year);
CREATE INDEX idx_budget_records_health_office ON public.budget_records(health_office_id, fiscal_year);

-- Trigger for updated_at
CREATE TRIGGER update_budget_records_updated_at
  BEFORE UPDATE ON public.budget_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE public.budget_records ENABLE ROW LEVEL SECURITY;

-- Policy: Hospital IT can view their hospital's budget
CREATE POLICY "Hospital can view own budget"
  ON public.budget_records FOR SELECT
  USING (
    hospital_id IN (SELECT hospital_id FROM profiles WHERE user_id = auth.uid() AND role = 'hospital_it')
  );

-- Policy: Hospital IT can insert their hospital's budget
CREATE POLICY "Hospital can insert own budget"
  ON public.budget_records FOR INSERT
  WITH CHECK (
    hospital_id IN (SELECT hospital_id FROM profiles WHERE user_id = auth.uid() AND role = 'hospital_it')
  );

-- Policy: Hospital IT can update their hospital's budget
CREATE POLICY "Hospital can update own budget"
  ON public.budget_records FOR UPDATE
  USING (
    hospital_id IN (SELECT hospital_id FROM profiles WHERE user_id = auth.uid() AND role = 'hospital_it')
  );

-- Policy: Hospital IT can delete their hospital's budget
CREATE POLICY "Hospital can delete own budget"
  ON public.budget_records FOR DELETE
  USING (
    hospital_id IN (SELECT hospital_id FROM profiles WHERE user_id = auth.uid() AND role = 'hospital_it')
  );

-- Policy: Health office can view their own budget
CREATE POLICY "Health office can view own budget"
  ON public.budget_records FOR SELECT
  USING (
    health_office_id IN (SELECT health_office_id FROM profiles WHERE user_id = auth.uid() AND role = 'health_office')
  );

-- Policy: Health office can insert their own budget
CREATE POLICY "Health office can insert own budget"
  ON public.budget_records FOR INSERT
  WITH CHECK (
    health_office_id IN (SELECT health_office_id FROM profiles WHERE user_id = auth.uid() AND role = 'health_office')
  );

-- Policy: Health office can update their own budget
CREATE POLICY "Health office can update own budget"
  ON public.budget_records FOR UPDATE
  USING (
    health_office_id IN (SELECT health_office_id FROM profiles WHERE user_id = auth.uid() AND role = 'health_office')
  );

-- Policy: Health office can delete their own budget
CREATE POLICY "Health office can delete own budget"
  ON public.budget_records FOR DELETE
  USING (
    health_office_id IN (SELECT health_office_id FROM profiles WHERE user_id = auth.uid() AND role = 'health_office')
  );

-- Policy: Provincial/Regional/Central can view all budgets in their scope
CREATE POLICY "Admins can view all budgets"
  ON public.budget_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND role IN ('provincial', 'regional', 'central_admin', 'supervisor')
    )
  );