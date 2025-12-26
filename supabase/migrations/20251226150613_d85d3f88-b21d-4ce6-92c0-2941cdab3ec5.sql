
-- Step 5: Update RLS policies for multi-tenancy

-- Update profiles RLS policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins and ROPs can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can view profiles" ON public.profiles
FOR SELECT USING (
  auth.uid() = id 
  OR public.is_super_admin(auth.uid())
  OR (company_id IS NOT NULL AND company_id = public.get_user_company_id(auth.uid()) AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'rop'::app_role)))
);

CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE USING (auth.uid() = id);

-- Update leads RLS policies
DROP POLICY IF EXISTS "Admins and ROPs can view all leads, sellers view assigned" ON public.leads;
DROP POLICY IF EXISTS "Only admins and ROPs can insert leads" ON public.leads;
DROP POLICY IF EXISTS "Admins and ROPs update all, sellers update assigned" ON public.leads;
DROP POLICY IF EXISTS "Only admins and ROPs can delete leads" ON public.leads;
DROP POLICY IF EXISTS "All users can add notes to leads" ON public.leads;

CREATE POLICY "View leads within company" ON public.leads
FOR SELECT USING (
  public.is_super_admin(auth.uid())
  OR (company_id = public.get_user_company_id(auth.uid()) AND (
    public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.has_role(auth.uid(), 'rop'::app_role) 
    OR seller_id = auth.uid()
  ))
);

CREATE POLICY "Insert leads within company" ON public.leads
FOR INSERT WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (company_id = public.get_user_company_id(auth.uid()) AND (
    public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.has_role(auth.uid(), 'rop'::app_role)
  ))
);

CREATE POLICY "Update leads within company" ON public.leads
FOR UPDATE USING (
  public.is_super_admin(auth.uid())
  OR (company_id = public.get_user_company_id(auth.uid()) AND (
    public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.has_role(auth.uid(), 'rop'::app_role) 
    OR seller_id = auth.uid()
  ))
);

CREATE POLICY "Delete leads within company" ON public.leads
FOR DELETE USING (
  public.is_super_admin(auth.uid())
  OR (company_id = public.get_user_company_id(auth.uid()) AND (
    public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.has_role(auth.uid(), 'rop'::app_role)
  ))
);

-- Update orders RLS policies
DROP POLICY IF EXISTS "Sellers can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Sellers can create own orders" ON public.orders;
DROP POLICY IF EXISTS "Sellers can update own orders" ON public.orders;
DROP POLICY IF EXISTS "Admins and ROPs can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;

CREATE POLICY "View orders within company" ON public.orders
FOR SELECT USING (
  public.is_super_admin(auth.uid())
  OR (company_id = public.get_user_company_id(auth.uid()) AND (
    public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.has_role(auth.uid(), 'rop'::app_role) 
    OR seller_id = auth.uid()
  ))
);

CREATE POLICY "Insert orders within company" ON public.orders
FOR INSERT WITH CHECK (
  company_id = public.get_user_company_id(auth.uid()) AND seller_id = auth.uid()
);

CREATE POLICY "Update orders within company" ON public.orders
FOR UPDATE USING (
  public.is_super_admin(auth.uid())
  OR (company_id = public.get_user_company_id(auth.uid()) AND (
    public.has_role(auth.uid(), 'admin'::app_role) 
    OR seller_id = auth.uid()
  ))
);

CREATE POLICY "Delete orders within company" ON public.orders
FOR DELETE USING (
  public.is_super_admin(auth.uid())
  OR (company_id = public.get_user_company_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'::app_role))
);

-- Update products RLS policies
DROP POLICY IF EXISTS "Authenticated users can view products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can insert products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can update products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users can delete products" ON public.products;

CREATE POLICY "View products within company" ON public.products
FOR SELECT USING (
  public.is_super_admin(auth.uid())
  OR company_id = public.get_user_company_id(auth.uid())
);

CREATE POLICY "Insert products within company" ON public.products
FOR INSERT WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (company_id = public.get_user_company_id(auth.uid()) AND (
    public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.has_role(auth.uid(), 'rop'::app_role)
  ))
);

CREATE POLICY "Update products within company" ON public.products
FOR UPDATE USING (
  public.is_super_admin(auth.uid())
  OR (company_id = public.get_user_company_id(auth.uid()) AND (
    public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.has_role(auth.uid(), 'rop'::app_role)
  ))
);

CREATE POLICY "Delete products within company" ON public.products
FOR DELETE USING (
  public.is_super_admin(auth.uid())
  OR (company_id = public.get_user_company_id(auth.uid()) AND (
    public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.has_role(auth.uid(), 'rop'::app_role)
  ))
);

-- Update stages RLS policies
DROP POLICY IF EXISTS "Everyone can view stages" ON public.stages;
DROP POLICY IF EXISTS "Admins and ROPs can insert stages" ON public.stages;
DROP POLICY IF EXISTS "Admins and ROPs can update stages" ON public.stages;
DROP POLICY IF EXISTS "Admins and ROPs can delete stages" ON public.stages;

CREATE POLICY "View stages within company" ON public.stages
FOR SELECT USING (
  public.is_super_admin(auth.uid())
  OR company_id = public.get_user_company_id(auth.uid())
);

CREATE POLICY "Insert stages within company" ON public.stages
FOR INSERT WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (company_id = public.get_user_company_id(auth.uid()) AND (
    public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.has_role(auth.uid(), 'rop'::app_role)
  ))
);

CREATE POLICY "Update stages within company" ON public.stages
FOR UPDATE USING (
  public.is_super_admin(auth.uid())
  OR (company_id = public.get_user_company_id(auth.uid()) AND (
    public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.has_role(auth.uid(), 'rop'::app_role)
  ))
);

CREATE POLICY "Delete stages within company" ON public.stages
FOR DELETE USING (
  public.is_super_admin(auth.uid())
  OR (company_id = public.get_user_company_id(auth.uid()) AND (
    public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.has_role(auth.uid(), 'rop'::app_role)
  ))
);

-- Update tasks RLS policies
DROP POLICY IF EXISTS "Users can view own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admins and ROPs can view all tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can create own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admins and ROPs can create tasks for anyone" ON public.tasks;

CREATE POLICY "View tasks within company" ON public.tasks
FOR SELECT USING (
  public.is_super_admin(auth.uid())
  OR (company_id = public.get_user_company_id(auth.uid()) AND (
    public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.has_role(auth.uid(), 'rop'::app_role) 
    OR seller_id = auth.uid()
  ))
);

CREATE POLICY "Insert tasks within company" ON public.tasks
FOR INSERT WITH CHECK (
  company_id = public.get_user_company_id(auth.uid()) AND (
    seller_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.has_role(auth.uid(), 'rop'::app_role)
  )
);

CREATE POLICY "Update tasks within company" ON public.tasks
FOR UPDATE USING (
  public.is_super_admin(auth.uid())
  OR (company_id = public.get_user_company_id(auth.uid()) AND seller_id = auth.uid())
);

CREATE POLICY "Delete tasks within company" ON public.tasks
FOR DELETE USING (
  public.is_super_admin(auth.uid())
  OR (company_id = public.get_user_company_id(auth.uid()) AND seller_id = auth.uid())
);

-- Update user_roles RLS policies
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins and ROPs can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins and ROPs can delete roles" ON public.user_roles;

CREATE POLICY "View roles within company" ON public.user_roles
FOR SELECT USING (
  auth.uid() = user_id
  OR public.is_super_admin(auth.uid())
  OR (company_id = public.get_user_company_id(auth.uid()) AND (
    public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.has_role(auth.uid(), 'rop'::app_role)
  ))
);

CREATE POLICY "Insert roles within company" ON public.user_roles
FOR INSERT WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (company_id = public.get_user_company_id(auth.uid()) AND (
    public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.has_role(auth.uid(), 'rop'::app_role)
  ))
);

CREATE POLICY "Delete roles within company" ON public.user_roles
FOR DELETE USING (
  public.is_super_admin(auth.uid())
  OR (company_id = public.get_user_company_id(auth.uid()) AND (
    public.has_role(auth.uid(), 'admin'::app_role) 
    OR public.has_role(auth.uid(), 'rop'::app_role)
  ))
);
