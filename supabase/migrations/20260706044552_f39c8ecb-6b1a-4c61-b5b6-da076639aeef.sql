-- Sequence for auto-incrementing registration number
CREATE SEQUENCE IF NOT EXISTS public.event_registrations_r1f26_seq START 1;

CREATE TABLE public.event_registrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_code TEXT NOT NULL DEFAULT 'r1next2026',
  registration_no TEXT NOT NULL UNIQUE
    DEFAULT ('R1F26-' || LPAD(nextval('public.event_registrations_r1f26_seq')::text, 5, '0')),
  full_name TEXT NOT NULL,
  position TEXT NOT NULL,
  organization TEXT NOT NULL,
  province TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  attend_day1 BOOLEAN NOT NULL DEFAULT true,
  attend_day2 BOOLEAN NOT NULL DEFAULT true,
  dietary TEXT NOT NULL DEFAULT 'normal',
  dietary_note TEXT,
  notes TEXT,
  email_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER SEQUENCE public.event_registrations_r1f26_seq OWNED BY public.event_registrations.registration_no;

CREATE INDEX idx_event_registrations_event_code ON public.event_registrations(event_code);
CREATE INDEX idx_event_registrations_created_at ON public.event_registrations(created_at DESC);

-- Grants required for PostgREST access
GRANT INSERT ON public.event_registrations TO anon;
GRANT USAGE ON SEQUENCE public.event_registrations_r1f26_seq TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_registrations TO authenticated;
GRANT USAGE ON SEQUENCE public.event_registrations_r1f26_seq TO authenticated;
GRANT ALL ON public.event_registrations TO service_role;
GRANT ALL ON SEQUENCE public.event_registrations_r1f26_seq TO service_role;

ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous) can register
CREATE POLICY "Anyone can register"
  ON public.event_registrations
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only central_admin and regional admins can view
CREATE POLICY "Admins can view registrations"
  ON public.event_registrations
  FOR SELECT
  TO authenticated
  USING (
    public.is_central_admin() OR public.is_regional_admin()
  );

-- Only central_admin and regional admins can update
CREATE POLICY "Admins can update registrations"
  ON public.event_registrations
  FOR UPDATE
  TO authenticated
  USING (
    public.is_central_admin() OR public.is_regional_admin()
  )
  WITH CHECK (
    public.is_central_admin() OR public.is_regional_admin()
  );

-- Only central_admin can delete
CREATE POLICY "Central admins can delete registrations"
  ON public.event_registrations
  FOR DELETE
  TO authenticated
  USING (public.is_central_admin());

-- updated_at trigger
CREATE TRIGGER update_event_registrations_updated_at
  BEFORE UPDATE ON public.event_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();