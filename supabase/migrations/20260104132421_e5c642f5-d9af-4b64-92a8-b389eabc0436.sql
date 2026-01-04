-- Add SELECT policy for public read access to impact_scores
CREATE POLICY "Anyone can view impact scores"
ON public.impact_scores
FOR SELECT
USING (true);