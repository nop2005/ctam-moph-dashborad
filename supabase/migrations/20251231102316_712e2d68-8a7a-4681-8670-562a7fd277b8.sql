-- Add new user role for health office (must be in separate transaction)
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'health_office';