-- Add index on cache_key for faster lookups
CREATE INDEX IF NOT EXISTS idx_internal_report_cache_cache_key 
ON public.internal_report_cache (cache_key);