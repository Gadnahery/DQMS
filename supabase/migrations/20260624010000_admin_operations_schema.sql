-- ==========================================
-- DQMS Admin Operations Schema Repair
-- ==========================================
-- Safe to run more than once. This repairs projects where the frontend was
-- deployed before the public schema tables/RPCs were applied.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  avg_handling_time_mins integer NOT NULL DEFAULT 5,
  color_theme text NOT NULL DEFAULT '#3b82f6',
  priority_weight integer NOT NULL DEFAULT 1,
  description text DEFAULT '',
  max_capacity integer DEFAULT 50,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.services ADD COLUMN IF NOT EXISTS priority_weight integer NOT NULL DEFAULT 1;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS description text DEFAULT '';
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS max_capacity integer DEFAULT 50;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now());

CREATE TABLE IF NOT EXISTS public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location text NOT NULL DEFAULT '',
  status text NOT NULL CHECK (status IN ('active', 'inactive', 'maintenance', 'paused')) DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.counters (
  id integer PRIMARY KEY,
  counter_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('online', 'offline', 'paused')) DEFAULT 'offline',
  current_service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  staff_name text DEFAULT '',
  last_active_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.counters ADD COLUMN IF NOT EXISTS current_service_id uuid REFERENCES public.services(id) ON DELETE SET NULL;
ALTER TABLE public.counters ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.counters ADD COLUMN IF NOT EXISTS staff_name text DEFAULT '';
ALTER TABLE public.counters ADD COLUMN IF NOT EXISTS last_active_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now());

CREATE TABLE IF NOT EXISTS public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number text NOT NULL,
  service_id uuid REFERENCES public.services(id) ON DELETE CASCADE,
  customer_name text DEFAULT 'Anonymous',
  customer_phone text DEFAULT '',
  priority text CHECK (priority IN ('normal', 'elderly', 'disabled', 'vip')) DEFAULT 'normal',
  status text CHECK (status IN ('waiting', 'serving', 'completed', 'cancelled')) DEFAULT 'waiting',
  counter_assigned integer,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  called_at timestamptz,
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number text NOT NULL,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  comments text DEFAULT '',
  sentiment text DEFAULT 'neutral',
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'supervisor', 'staff', 'customer')) DEFAULT 'customer',
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  action text NOT NULL,
  target text,
  result text NOT NULL DEFAULT 'success',
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.user_roles WHERE id = auth.uid() LIMIT 1),
    'customer'
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_roles (id, role)
  VALUES (
    NEW.id,
    CASE
      WHEN lower(NEW.email) = 'gadnahery7@gmail.com' THEN 'admin'
      ELSE 'customer'
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

INSERT INTO public.user_roles (id, role)
SELECT id, 'admin'
FROM auth.users
WHERE lower(email) = 'gadnahery7@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

CREATE OR REPLACE FUNCTION public.join_queue(
  service_id_param uuid,
  name_param text,
  phone_param text,
  priority_param text
)
RETURNS json AS $$
DECLARE
  service_code text;
  avg_time integer;
  ticket_seq integer;
  ticket_num text;
  new_ticket json;
  people_ahead_count integer;
BEGIN
  SELECT code, avg_handling_time_mins
  INTO service_code, avg_time
  FROM public.services
  WHERE id = service_id_param AND is_active = true;

  IF service_code IS NULL THEN
    RAISE EXCEPTION 'Service not found or inactive';
  END IF;

  SELECT count(*) + 101
  INTO ticket_seq
  FROM public.tickets
  WHERE service_id = service_id_param AND created_at::date = current_date;

  ticket_num := service_code || '-' || ticket_seq;

  SELECT count(*)
  INTO people_ahead_count
  FROM public.tickets
  WHERE service_id = service_id_param AND status = 'waiting';

  INSERT INTO public.tickets (ticket_number, service_id, customer_name, customer_phone, priority, status)
  VALUES (ticket_num, service_id_param, name_param, phone_param, priority_param, 'waiting')
  RETURNING json_build_object(
    'id', id,
    'ticket_number', ticket_number,
    'status', status,
    'created_at', created_at
  ) INTO new_ticket;

  RETURN json_build_object(
    'success', true,
    'ticket', new_ticket,
    'people_ahead', people_ahead_count,
    'wait_time_mins', people_ahead_count * avg_time
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.call_next(
  counter_id_param integer,
  service_id_param uuid
)
RETURNS json AS $$
DECLARE
  next_ticket record;
BEGIN
  SELECT *
  INTO next_ticket
  FROM public.tickets
  WHERE status = 'waiting'
    AND (service_id_param IS NULL OR service_id = service_id_param)
  ORDER BY
    CASE
      WHEN priority = 'vip' THEN 1
      WHEN priority = 'disabled' THEN 2
      WHEN priority = 'elderly' THEN 3
      ELSE 4
    END,
    created_at
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF next_ticket.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No customers waiting');
  END IF;

  UPDATE public.tickets
  SET status = 'serving', counter_assigned = counter_id_param, called_at = now()
  WHERE id = next_ticket.id;

  UPDATE public.counters
  SET status = 'online', last_active_at = now()
  WHERE id = counter_id_param;

  RETURN json_build_object(
    'success', true,
    'ticket_id', next_ticket.id,
    'ticket_number', next_ticket.ticket_number,
    'customer_name', next_ticket.customer_name,
    'counter', counter_id_param
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.reset_queue()
RETURNS json AS $$
BEGIN
  UPDATE public.tickets
  SET status = 'cancelled', completed_at = now()
  WHERE status IN ('waiting', 'serving');

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

INSERT INTO public.services (name, code, avg_handling_time_mins, color_theme, priority_weight, is_active)
VALUES
  ('General Registration', 'REG', 8, '#3b82f6', 1, true),
  ('Cashier & Payments', 'PAY', 4, '#10b981', 1, true),
  ('Customer Support', 'SUP', 15, '#f59e0b', 1, true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.branches (name, location, status)
VALUES ('Main Branch', 'Headquarters', 'active')
ON CONFLICT DO NOTHING;

INSERT INTO public.counters (id, counter_name, status)
VALUES
  (1, 'Counter 1', 'offline'),
  (2, 'Counter 2', 'offline'),
  (3, 'Counter 3', 'offline')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.app_settings (key, value)
VALUES
  ('institution_name', 'DQMS Institution'),
  ('max_queue_size', '50')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view services" ON public.services;
DROP POLICY IF EXISTS "Admins can insert services" ON public.services;
DROP POLICY IF EXISTS "Admins can update services" ON public.services;
DROP POLICY IF EXISTS "Admins can delete services" ON public.services;
CREATE POLICY "Anyone can view services" ON public.services FOR SELECT USING (true);
CREATE POLICY "Admins can insert services" ON public.services FOR INSERT WITH CHECK (public.get_my_role() = 'admin');
CREATE POLICY "Admins can update services" ON public.services FOR UPDATE USING (public.get_my_role() = 'admin');
CREATE POLICY "Admins can delete services" ON public.services FOR DELETE USING (public.get_my_role() = 'admin');

DROP POLICY IF EXISTS "Anyone can view branches" ON public.branches;
DROP POLICY IF EXISTS "Admins can insert branches" ON public.branches;
DROP POLICY IF EXISTS "Admins can update branches" ON public.branches;
DROP POLICY IF EXISTS "Admins can delete branches" ON public.branches;
CREATE POLICY "Anyone can view branches" ON public.branches FOR SELECT USING (true);
CREATE POLICY "Admins can insert branches" ON public.branches FOR INSERT WITH CHECK (public.get_my_role() = 'admin');
CREATE POLICY "Admins can update branches" ON public.branches FOR UPDATE USING (public.get_my_role() = 'admin');
CREATE POLICY "Admins can delete branches" ON public.branches FOR DELETE USING (public.get_my_role() = 'admin');

DROP POLICY IF EXISTS "Anyone can view counters" ON public.counters;
DROP POLICY IF EXISTS "Admins can insert counters" ON public.counters;
DROP POLICY IF EXISTS "Admins can update counters" ON public.counters;
DROP POLICY IF EXISTS "Admins can delete counters" ON public.counters;
CREATE POLICY "Anyone can view counters" ON public.counters FOR SELECT USING (true);
CREATE POLICY "Admins can insert counters" ON public.counters FOR INSERT WITH CHECK (public.get_my_role() = 'admin');
CREATE POLICY "Admins can update counters" ON public.counters FOR UPDATE USING (public.get_my_role() IN ('admin', 'supervisor'));
CREATE POLICY "Admins can delete counters" ON public.counters FOR DELETE USING (public.get_my_role() = 'admin');

DROP POLICY IF EXISTS "Anyone can insert tickets" ON public.tickets;
DROP POLICY IF EXISTS "Anyone can view tickets" ON public.tickets;
DROP POLICY IF EXISTS "Staff can update tickets" ON public.tickets;
CREATE POLICY "Anyone can insert tickets" ON public.tickets FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can view tickets" ON public.tickets FOR SELECT USING (true);
CREATE POLICY "Staff can update tickets" ON public.tickets FOR UPDATE USING (public.get_my_role() IN ('admin', 'supervisor', 'staff'));

DROP POLICY IF EXISTS "Anyone can view announcements" ON public.announcements;
DROP POLICY IF EXISTS "Staff can write announcements" ON public.announcements;
CREATE POLICY "Anyone can view announcements" ON public.announcements FOR SELECT USING (true);
CREATE POLICY "Staff can write announcements" ON public.announcements FOR ALL USING (public.get_my_role() IN ('admin', 'supervisor')) WITH CHECK (public.get_my_role() IN ('admin', 'supervisor'));

DROP POLICY IF EXISTS "Anyone can submit feedback" ON public.feedback;
DROP POLICY IF EXISTS "Staff can view feedback" ON public.feedback;
CREATE POLICY "Anyone can submit feedback" ON public.feedback FOR INSERT WITH CHECK (true);
CREATE POLICY "Staff can view feedback" ON public.feedback FOR SELECT USING (public.get_my_role() IN ('admin', 'supervisor', 'staff'));

DROP POLICY IF EXISTS "Users can read their own role" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can read all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
CREATE POLICY "Users can read their own role" ON public.user_roles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can read all roles" ON public.user_roles FOR SELECT USING (public.get_my_role() = 'admin');
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE USING (public.get_my_role() = 'admin');

DROP POLICY IF EXISTS "Admins can manage settings" ON public.app_settings;
CREATE POLICY "Admins can manage settings" ON public.app_settings FOR ALL USING (public.get_my_role() = 'admin') WITH CHECK (public.get_my_role() = 'admin');

DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Staff can insert audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT USING (public.get_my_role() IN ('admin', 'supervisor'));
CREATE POLICY "Staff can insert audit logs" ON public.audit_logs FOR INSERT WITH CHECK (public.get_my_role() IN ('admin', 'supervisor', 'staff'));
