-- Drop the existing INSERT policy for leads
DROP POLICY IF EXISTS "Insert leads within company" ON public.leads;

-- Create new INSERT policy that allows sellers to create leads for themselves
CREATE POLICY "Insert leads within company"
ON public.leads
FOR INSERT
WITH CHECK (
  is_super_admin(auth.uid()) 
  OR (
    company_access_allowed(auth.uid()) 
    AND (company_id IS NOT NULL) 
    AND (company_id = get_user_company_id(auth.uid())) 
    AND (
      has_role(auth.uid(), 'admin'::app_role) 
      OR has_role(auth.uid(), 'rop'::app_role)
      OR (has_role(auth.uid(), 'sotuvchi'::app_role) AND seller_id = auth.uid())
    )
  )
);