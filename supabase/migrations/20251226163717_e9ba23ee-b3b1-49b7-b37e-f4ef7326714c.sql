-- Update get_user_company_id function to handle NULL case better
CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE id = _user_id AND company_id IS NOT NULL LIMIT 1
$$;

-- Update RLS policies to require company_id to be NOT NULL for proper isolation

-- Leads policies
DROP POLICY IF EXISTS "View leads within company" ON public.leads;
CREATE POLICY "View leads within company" ON public.leads
FOR SELECT USING (
  is_super_admin(auth.uid()) 
  OR (
    company_access_allowed(auth.uid()) 
    AND company_id IS NOT NULL
    AND company_id = get_user_company_id(auth.uid()) 
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rop'::app_role) OR (seller_id = auth.uid()))
  )
);

DROP POLICY IF EXISTS "Insert leads within company" ON public.leads;
CREATE POLICY "Insert leads within company" ON public.leads
FOR INSERT WITH CHECK (
  is_super_admin(auth.uid()) 
  OR (
    company_access_allowed(auth.uid()) 
    AND company_id IS NOT NULL
    AND company_id = get_user_company_id(auth.uid()) 
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rop'::app_role))
  )
);

DROP POLICY IF EXISTS "Update leads within company" ON public.leads;
CREATE POLICY "Update leads within company" ON public.leads
FOR UPDATE USING (
  is_super_admin(auth.uid()) 
  OR (
    company_access_allowed(auth.uid()) 
    AND company_id IS NOT NULL
    AND company_id = get_user_company_id(auth.uid()) 
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rop'::app_role) OR (seller_id = auth.uid()))
  )
);

DROP POLICY IF EXISTS "Delete leads within company" ON public.leads;
CREATE POLICY "Delete leads within company" ON public.leads
FOR DELETE USING (
  is_super_admin(auth.uid()) 
  OR (
    company_access_allowed(auth.uid()) 
    AND company_id IS NOT NULL
    AND company_id = get_user_company_id(auth.uid()) 
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rop'::app_role))
  )
);

-- Orders policies
DROP POLICY IF EXISTS "View orders within company" ON public.orders;
CREATE POLICY "View orders within company" ON public.orders
FOR SELECT USING (
  is_super_admin(auth.uid()) 
  OR (
    company_access_allowed(auth.uid()) 
    AND company_id IS NOT NULL
    AND company_id = get_user_company_id(auth.uid()) 
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rop'::app_role) OR (seller_id = auth.uid()))
  )
);

DROP POLICY IF EXISTS "Insert orders within company" ON public.orders;
CREATE POLICY "Insert orders within company" ON public.orders
FOR INSERT WITH CHECK (
  company_access_allowed(auth.uid()) 
  AND company_id IS NOT NULL
  AND company_id = get_user_company_id(auth.uid()) 
  AND (seller_id = auth.uid())
);

DROP POLICY IF EXISTS "Update orders within company" ON public.orders;
CREATE POLICY "Update orders within company" ON public.orders
FOR UPDATE USING (
  is_super_admin(auth.uid()) 
  OR (
    company_access_allowed(auth.uid()) 
    AND company_id IS NOT NULL
    AND company_id = get_user_company_id(auth.uid()) 
    AND (has_role(auth.uid(), 'admin'::app_role) OR (seller_id = auth.uid()))
  )
);

DROP POLICY IF EXISTS "Delete orders within company" ON public.orders;
CREATE POLICY "Delete orders within company" ON public.orders
FOR DELETE USING (
  is_super_admin(auth.uid()) 
  OR (
    company_access_allowed(auth.uid()) 
    AND company_id IS NOT NULL
    AND company_id = get_user_company_id(auth.uid()) 
    AND has_role(auth.uid(), 'admin'::app_role)
  )
);

-- Products policies
DROP POLICY IF EXISTS "View products within company" ON public.products;
CREATE POLICY "View products within company" ON public.products
FOR SELECT USING (
  is_super_admin(auth.uid()) 
  OR (
    company_access_allowed(auth.uid()) 
    AND company_id IS NOT NULL
    AND company_id = get_user_company_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "Insert products within company" ON public.products;
CREATE POLICY "Insert products within company" ON public.products
FOR INSERT WITH CHECK (
  is_super_admin(auth.uid()) 
  OR (
    company_access_allowed(auth.uid()) 
    AND company_id IS NOT NULL
    AND company_id = get_user_company_id(auth.uid()) 
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rop'::app_role))
  )
);

DROP POLICY IF EXISTS "Update products within company" ON public.products;
CREATE POLICY "Update products within company" ON public.products
FOR UPDATE USING (
  is_super_admin(auth.uid()) 
  OR (
    company_access_allowed(auth.uid()) 
    AND company_id IS NOT NULL
    AND company_id = get_user_company_id(auth.uid()) 
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rop'::app_role))
  )
);

DROP POLICY IF EXISTS "Delete products within company" ON public.products;
CREATE POLICY "Delete products within company" ON public.products
FOR DELETE USING (
  is_super_admin(auth.uid()) 
  OR (
    company_access_allowed(auth.uid()) 
    AND company_id IS NOT NULL
    AND company_id = get_user_company_id(auth.uid()) 
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rop'::app_role))
  )
);

-- Stages policies
DROP POLICY IF EXISTS "View stages within company" ON public.stages;
CREATE POLICY "View stages within company" ON public.stages
FOR SELECT USING (
  is_super_admin(auth.uid()) 
  OR (
    company_access_allowed(auth.uid()) 
    AND company_id IS NOT NULL
    AND company_id = get_user_company_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "Insert stages within company" ON public.stages;
CREATE POLICY "Insert stages within company" ON public.stages
FOR INSERT WITH CHECK (
  is_super_admin(auth.uid()) 
  OR (
    company_access_allowed(auth.uid()) 
    AND company_id IS NOT NULL
    AND company_id = get_user_company_id(auth.uid()) 
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rop'::app_role))
  )
);

DROP POLICY IF EXISTS "Update stages within company" ON public.stages;
CREATE POLICY "Update stages within company" ON public.stages
FOR UPDATE USING (
  is_super_admin(auth.uid()) 
  OR (
    company_access_allowed(auth.uid()) 
    AND company_id IS NOT NULL
    AND company_id = get_user_company_id(auth.uid()) 
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rop'::app_role))
  )
);

DROP POLICY IF EXISTS "Delete stages within company" ON public.stages;
CREATE POLICY "Delete stages within company" ON public.stages
FOR DELETE USING (
  is_super_admin(auth.uid()) 
  OR (
    company_access_allowed(auth.uid()) 
    AND company_id IS NOT NULL
    AND company_id = get_user_company_id(auth.uid()) 
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rop'::app_role))
  )
);

-- Tasks policies
DROP POLICY IF EXISTS "View tasks within company" ON public.tasks;
CREATE POLICY "View tasks within company" ON public.tasks
FOR SELECT USING (
  is_super_admin(auth.uid()) 
  OR (
    company_access_allowed(auth.uid()) 
    AND company_id IS NOT NULL
    AND company_id = get_user_company_id(auth.uid()) 
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rop'::app_role) OR (seller_id = auth.uid()))
  )
);

DROP POLICY IF EXISTS "Insert tasks within company" ON public.tasks;
CREATE POLICY "Insert tasks within company" ON public.tasks
FOR INSERT WITH CHECK (
  company_access_allowed(auth.uid()) 
  AND company_id IS NOT NULL
  AND company_id = get_user_company_id(auth.uid()) 
  AND ((seller_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rop'::app_role))
);

DROP POLICY IF EXISTS "Update tasks within company" ON public.tasks;
CREATE POLICY "Update tasks within company" ON public.tasks
FOR UPDATE USING (
  is_super_admin(auth.uid()) 
  OR (
    company_access_allowed(auth.uid()) 
    AND company_id IS NOT NULL
    AND company_id = get_user_company_id(auth.uid()) 
    AND (seller_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "Delete tasks within company" ON public.tasks;
CREATE POLICY "Delete tasks within company" ON public.tasks
FOR DELETE USING (
  is_super_admin(auth.uid()) 
  OR (
    company_access_allowed(auth.uid()) 
    AND company_id IS NOT NULL
    AND company_id = get_user_company_id(auth.uid()) 
    AND (seller_id = auth.uid())
  )
);

-- User roles policies
DROP POLICY IF EXISTS "View roles within company" ON public.user_roles;
CREATE POLICY "View roles within company" ON public.user_roles
FOR SELECT USING (
  (auth.uid() = user_id) 
  OR is_super_admin(auth.uid()) 
  OR (
    company_access_allowed(auth.uid()) 
    AND company_id IS NOT NULL
    AND company_id = get_user_company_id(auth.uid()) 
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rop'::app_role))
  )
);

DROP POLICY IF EXISTS "Insert roles within company" ON public.user_roles;
CREATE POLICY "Insert roles within company" ON public.user_roles
FOR INSERT WITH CHECK (
  is_super_admin(auth.uid()) 
  OR (
    company_access_allowed(auth.uid()) 
    AND company_id IS NOT NULL
    AND company_id = get_user_company_id(auth.uid()) 
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rop'::app_role))
  )
);

DROP POLICY IF EXISTS "Delete roles within company" ON public.user_roles;
CREATE POLICY "Delete roles within company" ON public.user_roles
FOR DELETE USING (
  is_super_admin(auth.uid()) 
  OR (
    company_access_allowed(auth.uid()) 
    AND company_id IS NOT NULL
    AND company_id = get_user_company_id(auth.uid()) 
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rop'::app_role))
  )
);