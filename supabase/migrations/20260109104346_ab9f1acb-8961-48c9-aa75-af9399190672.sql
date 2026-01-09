-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Insert tasks within company" ON public.tasks;

-- Create new INSERT policy allowing admin/rop to assign tasks to any seller in their company
CREATE POLICY "Insert tasks within company" 
ON public.tasks 
FOR INSERT 
WITH CHECK (
  company_access_allowed(auth.uid()) 
  AND company_id IS NOT NULL 
  AND company_id = get_user_company_id(auth.uid())
  AND (
    seller_id = auth.uid() 
    OR has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'rop'::app_role)
  )
);