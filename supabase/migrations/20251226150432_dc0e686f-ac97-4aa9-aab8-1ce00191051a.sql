
-- Step 2: Create is_super_admin function (if not exists)
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text = 'super_admin'
  )
$$;

-- Step 3: Create companies table
CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  logo_url text,
  is_active boolean NOT NULL DEFAULT true,
  subscription_status text NOT NULL DEFAULT 'trial',
  subscription_ends_at timestamp with time zone,
  max_users integer DEFAULT 5,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for companies (super admin only initially)
CREATE POLICY "Super admins can view all companies" ON public.companies
FOR SELECT USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can insert companies" ON public.companies
FOR INSERT WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update companies" ON public.companies
FOR UPDATE USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can delete companies" ON public.companies
FOR DELETE USING (public.is_super_admin(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_companies_slug ON public.companies(slug);
CREATE INDEX IF NOT EXISTS idx_companies_is_active ON public.companies(is_active);
