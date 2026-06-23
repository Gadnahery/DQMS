-- ==========================================
-- DQMS Phase 2: Roles and Authentication
-- ==========================================

-- 1. Create Roles Table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text CHECK (role IN ('admin', 'supervisor', 'staff', 'customer')) DEFAULT 'customer',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Users can read their own role
CREATE POLICY "Users can read their own role"
ON public.user_roles FOR SELECT
USING (auth.uid() = id);

-- Admins can read all roles
CREATE POLICY "Admins can read all roles"
ON public.user_roles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 2. Auth Trigger for New Users
-- Automatically assigns 'customer' role on sign up, unless the email is gadnahery7@gmail.com
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_roles (id, role)
  VALUES (
    NEW.id,
    CASE 
      WHEN NEW.email = 'gadnahery7@gmail.com' THEN 'admin'
      ELSE 'customer'
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if it exists, then recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ==========================================
-- 3. Row Level Security Policies
-- ==========================================

-- Services table RLS
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- Anyone can view services
CREATE POLICY "Anyone can view services"
ON public.services FOR SELECT
USING (true);

-- Only admins can modify services
CREATE POLICY "Admins can insert services"
ON public.services FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update services"
ON public.services FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can delete services"
ON public.services FOR DELETE
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE id = auth.uid() AND role = 'admin'));

-- Tickets table RLS
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Anyone can insert tickets (customers joining queue)
CREATE POLICY "Anyone can insert tickets"
ON public.tickets FOR INSERT
WITH CHECK (true);

-- Staff/Admins can view all tickets
CREATE POLICY "Staff can view all tickets"
ON public.tickets FOR SELECT
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE id = auth.uid() AND role IN ('admin', 'supervisor', 'staff')));

-- Customers can view all tickets (for the display board and estimating queue size)
-- Note: Sensitive data should be handled carefully, but for queue estimation, select is open
CREATE POLICY "Anyone can view tickets"
ON public.tickets FOR SELECT
USING (true);

-- Staff can update tickets
CREATE POLICY "Staff can update tickets"
ON public.tickets FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE id = auth.uid() AND role IN ('admin', 'supervisor', 'staff')));
