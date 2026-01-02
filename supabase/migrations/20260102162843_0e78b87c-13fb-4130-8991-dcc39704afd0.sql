-- Add new 'supervisor' role to the user_role enum
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'supervisor';