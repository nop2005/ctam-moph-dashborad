-- Add position and organization columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS position text,
ADD COLUMN IF NOT EXISTS organization text;