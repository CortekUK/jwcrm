-- Create finance_roles table for sub-role scoping within the finance module
CREATE TABLE IF NOT EXISTS public.finance_roles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('head', 'employee')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.finance_roles ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read finance roles
CREATE POLICY "Authenticated users can read finance_roles"
  ON public.finance_roles
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admin/superadmin can insert/update/delete
CREATE POLICY "Admins can manage finance_roles"
  ON public.finance_roles
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'superadmin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'superadmin')
    )
  );

-- Seed Samir and Melisa as finance heads
INSERT INTO public.finance_roles (user_id, role)
SELECT id, 'head' FROM auth.users WHERE email = 'samir@justwills.co'
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.finance_roles (user_id, role)
SELECT id, 'head' FROM auth.users WHERE email = 'melisa@justwills.co'
ON CONFLICT (user_id) DO NOTHING;
