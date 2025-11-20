-- Drop existing RLS policies for leads
DROP POLICY IF EXISTS "Only admins and ROPs can view leads" ON public.leads;
DROP POLICY IF EXISTS "Only admins and ROPs can insert leads" ON public.leads;
DROP POLICY IF EXISTS "Only admins and ROPs can update leads" ON public.leads;
DROP POLICY IF EXISTS "Only admins and ROPs can delete leads" ON public.leads;

-- Create new RLS policies for leads
-- Admins and ROPs can view all leads, sellers can only view their assigned leads
CREATE POLICY "Admins and ROPs can view all leads, sellers view assigned"
ON public.leads
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'rop'::app_role)
  OR seller_id = auth.uid()
);

-- Only admins and ROPs can insert leads
CREATE POLICY "Only admins and ROPs can insert leads"
ON public.leads
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'rop'::app_role)
);

-- Admins and ROPs can update all leads, sellers can update their assigned leads
CREATE POLICY "Admins and ROPs update all, sellers update assigned"
ON public.leads
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'rop'::app_role)
  OR seller_id = auth.uid()
);

-- Only admins and ROPs can delete leads
CREATE POLICY "Only admins and ROPs can delete leads"
ON public.leads
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'rop'::app_role)
);