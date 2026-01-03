-- Add policies for public (anonymous) access to read health_regions
CREATE POLICY "Public can view health regions" 
ON public.health_regions 
FOR SELECT 
USING (true);

-- Add policies for public (anonymous) access to read provinces
CREATE POLICY "Public can view provinces" 
ON public.provinces 
FOR SELECT 
USING (true);

-- Add policies for public (anonymous) access to read hospitals
CREATE POLICY "Public can view hospitals" 
ON public.hospitals 
FOR SELECT 
USING (true);

-- Add policies for public (anonymous) access to read health_offices
CREATE POLICY "Public can view health offices" 
ON public.health_offices 
FOR SELECT 
USING (true);

-- Add policies for public (anonymous) access to read ctam_categories
CREATE POLICY "Public can view CTAM categories" 
ON public.ctam_categories 
FOR SELECT 
USING (true);

-- Add policies for public (anonymous) access to read assessments
CREATE POLICY "Public can view all assessments for reports" 
ON public.assessments 
FOR SELECT 
USING (true);

-- Add policies for public (anonymous) access to read assessment_items
CREATE POLICY "Public can view assessment items for reports" 
ON public.assessment_items 
FOR SELECT 
USING (true);