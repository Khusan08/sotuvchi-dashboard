-- Update RLS policies for leads table - only admin and ROP can access
DROP POLICY IF EXISTS "Sellers can view own leads" ON public.leads;
DROP POLICY IF EXISTS "Sellers can create own leads" ON public.leads;
DROP POLICY IF EXISTS "Sellers can update own leads" ON public.leads;
DROP POLICY IF EXISTS "Admins and ROPs can view all leads" ON public.leads;

-- Only admins and ROPs can view all leads
CREATE POLICY "Only admins and ROPs can view leads"
ON public.leads
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'rop'::app_role)
);

-- Only admins and ROPs can insert leads
CREATE POLICY "Only admins and ROPs can insert leads"
ON public.leads
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'rop'::app_role)
);

-- Only admins and ROPs can update leads
CREATE POLICY "Only admins and ROPs can update leads"
ON public.leads
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'rop'::app_role)
);

-- Only admins and ROPs can delete leads
CREATE POLICY "Only admins and ROPs can delete leads"
ON public.leads
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'rop'::app_role)
);