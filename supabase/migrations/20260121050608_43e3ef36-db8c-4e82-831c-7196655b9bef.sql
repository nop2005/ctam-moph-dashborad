-- Add title_prefix column to personnel table
ALTER TABLE public.personnel
ADD COLUMN title_prefix TEXT;