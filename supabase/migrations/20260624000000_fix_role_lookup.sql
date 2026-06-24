-- ==========================================
-- DQMS: Repair role lookup for existing users
-- ==========================================

-- The frontend expects this RPC for role checks. Keep it SECURITY DEFINER so
-- callers can only resolve their own role while avoiding RLS recursion issues.
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT role
      FROM public.user_roles
      WHERE id = auth.uid()
      LIMIT 1
    ),
    'customer'
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

DROP POLICY IF EXISTS "Admins can read all roles" ON public.user_roles;

CREATE POLICY "Admins can read all roles"
ON public.user_roles FOR SELECT
USING (public.get_my_role() = 'admin');

-- Backfill the known administrator in case the auth user existed before the
-- handle_new_user trigger was installed.
INSERT INTO public.user_roles (id, role)
SELECT id, 'admin'
FROM auth.users
WHERE lower(email) = 'gadnahery7@gmail.com'
ON CONFLICT (id) DO UPDATE
SET role = EXCLUDED.role;
