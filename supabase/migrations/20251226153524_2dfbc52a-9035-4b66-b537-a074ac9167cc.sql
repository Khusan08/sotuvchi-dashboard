-- Subscription gating: data stays, access blocks when expired/cancelled

CREATE OR REPLACE FUNCTION public.company_access_allowed(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_super_admin(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.companies c ON c.id = p.company_id
      WHERE p.id = _user_id
        AND c.is_active = true
        AND c.subscription_status <> 'cancelled'
        AND (c.subscription_ends_at IS NULL OR c.subscription_ends_at > now())
    )
$$;

-- leads
DROP POLICY IF EXISTS "View leads within company" ON public.leads;
DROP POLICY IF EXISTS "Insert leads within company" ON public.leads;
DROP POLICY IF EXISTS "Update leads within company" ON public.leads;
DROP POLICY IF EXISTS "Delete leads within company" ON public.leads;

CREATE POLICY "View leads within company" ON public.leads
FOR SELECT USING (
  public.is_super_admin(auth.uid())
  OR (
    public.company_access_allowed(auth.uid())
    AND company_id = public.get_user_company_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'rop'::app_role)
      OR seller_id = auth.uid()
    )
  )
);

CREATE POLICY "Insert leads within company" ON public.leads
FOR INSERT WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (
    public.company_access_allowed(auth.uid())
    AND company_id = public.get_user_company_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'rop'::app_role)
    )
  )
);

CREATE POLICY "Update leads within company" ON public.leads
FOR UPDATE USING (
  public.is_super_admin(auth.uid())
  OR (
    public.company_access_allowed(auth.uid())
    AND company_id = public.get_user_company_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'rop'::app_role)
      OR seller_id = auth.uid()
    )
  )
);

CREATE POLICY "Delete leads within company" ON public.leads
FOR DELETE USING (
  public.is_super_admin(auth.uid())
  OR (
    public.company_access_allowed(auth.uid())
    AND company_id = public.get_user_company_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'rop'::app_role)
    )
  )
);

-- orders
DROP POLICY IF EXISTS "View orders within company" ON public.orders;
DROP POLICY IF EXISTS "Insert orders within company" ON public.orders;
DROP POLICY IF EXISTS "Update orders within company" ON public.orders;
DROP POLICY IF EXISTS "Delete orders within company" ON public.orders;

CREATE POLICY "View orders within company" ON public.orders
FOR SELECT USING (
  public.is_super_admin(auth.uid())
  OR (
    public.company_access_allowed(auth.uid())
    AND company_id = public.get_user_company_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'rop'::app_role)
      OR seller_id = auth.uid()
    )
  )
);

CREATE POLICY "Insert orders within company" ON public.orders
FOR INSERT WITH CHECK (
  public.company_access_allowed(auth.uid())
  AND company_id = public.get_user_company_id(auth.uid())
  AND seller_id = auth.uid()
);

CREATE POLICY "Update orders within company" ON public.orders
FOR UPDATE USING (
  public.is_super_admin(auth.uid())
  OR (
    public.company_access_allowed(auth.uid())
    AND company_id = public.get_user_company_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR seller_id = auth.uid()
    )
  )
);

CREATE POLICY "Delete orders within company" ON public.orders
FOR DELETE USING (
  public.is_super_admin(auth.uid())
  OR (
    public.company_access_allowed(auth.uid())
    AND company_id = public.get_user_company_id(auth.uid())
    AND public.has_role(auth.uid(), 'admin'::app_role)
  )
);

-- products
DROP POLICY IF EXISTS "View products within company" ON public.products;
DROP POLICY IF EXISTS "Insert products within company" ON public.products;
DROP POLICY IF EXISTS "Update products within company" ON public.products;
DROP POLICY IF EXISTS "Delete products within company" ON public.products;

CREATE POLICY "View products within company" ON public.products
FOR SELECT USING (
  public.is_super_admin(auth.uid())
  OR (
    public.company_access_allowed(auth.uid())
    AND company_id = public.get_user_company_id(auth.uid())
  )
);

CREATE POLICY "Insert products within company" ON public.products
FOR INSERT WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (
    public.company_access_allowed(auth.uid())
    AND company_id = public.get_user_company_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'rop'::app_role)
    )
  )
);

CREATE POLICY "Update products within company" ON public.products
FOR UPDATE USING (
  public.is_super_admin(auth.uid())
  OR (
    public.company_access_allowed(auth.uid())
    AND company_id = public.get_user_company_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'rop'::app_role)
    )
  )
);

CREATE POLICY "Delete products within company" ON public.products
FOR DELETE USING (
  public.is_super_admin(auth.uid())
  OR (
    public.company_access_allowed(auth.uid())
    AND company_id = public.get_user_company_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'rop'::app_role)
    )
  )
);

-- stages
DROP POLICY IF EXISTS "View stages within company" ON public.stages;
DROP POLICY IF EXISTS "Insert stages within company" ON public.stages;
DROP POLICY IF EXISTS "Update stages within company" ON public.stages;
DROP POLICY IF EXISTS "Delete stages within company" ON public.stages;

CREATE POLICY "View stages within company" ON public.stages
FOR SELECT USING (
  public.is_super_admin(auth.uid())
  OR (
    public.company_access_allowed(auth.uid())
    AND company_id = public.get_user_company_id(auth.uid())
  )
);

CREATE POLICY "Insert stages within company" ON public.stages
FOR INSERT WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (
    public.company_access_allowed(auth.uid())
    AND company_id = public.get_user_company_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'rop'::app_role)
    )
  )
);

CREATE POLICY "Update stages within company" ON public.stages
FOR UPDATE USING (
  public.is_super_admin(auth.uid())
  OR (
    public.company_access_allowed(auth.uid())
    AND company_id = public.get_user_company_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'rop'::app_role)
    )
  )
);

CREATE POLICY "Delete stages within company" ON public.stages
FOR DELETE USING (
  public.is_super_admin(auth.uid())
  OR (
    public.company_access_allowed(auth.uid())
    AND company_id = public.get_user_company_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'rop'::app_role)
    )
  )
);

-- tasks
DROP POLICY IF EXISTS "View tasks within company" ON public.tasks;
DROP POLICY IF EXISTS "Insert tasks within company" ON public.tasks;
DROP POLICY IF EXISTS "Update tasks within company" ON public.tasks;
DROP POLICY IF EXISTS "Delete tasks within company" ON public.tasks;

CREATE POLICY "View tasks within company" ON public.tasks
FOR SELECT USING (
  public.is_super_admin(auth.uid())
  OR (
    public.company_access_allowed(auth.uid())
    AND company_id = public.get_user_company_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'rop'::app_role)
      OR seller_id = auth.uid()
    )
  )
);

CREATE POLICY "Insert tasks within company" ON public.tasks
FOR INSERT WITH CHECK (
  public.company_access_allowed(auth.uid())
  AND company_id = public.get_user_company_id(auth.uid())
  AND (
    seller_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'rop'::app_role)
  )
);

CREATE POLICY "Update tasks within company" ON public.tasks
FOR UPDATE USING (
  public.is_super_admin(auth.uid())
  OR (
    public.company_access_allowed(auth.uid())
    AND company_id = public.get_user_company_id(auth.uid())
    AND seller_id = auth.uid()
  )
);

CREATE POLICY "Delete tasks within company" ON public.tasks
FOR DELETE USING (
  public.is_super_admin(auth.uid())
  OR (
    public.company_access_allowed(auth.uid())
    AND company_id = public.get_user_company_id(auth.uid())
    AND seller_id = auth.uid()
  )
);

-- user_roles (keep own-role visibility even if expired)
DROP POLICY IF EXISTS "View roles within company" ON public.user_roles;
DROP POLICY IF EXISTS "Insert roles within company" ON public.user_roles;
DROP POLICY IF EXISTS "Delete roles within company" ON public.user_roles;

CREATE POLICY "View roles within company" ON public.user_roles
FOR SELECT USING (
  auth.uid() = user_id
  OR public.is_super_admin(auth.uid())
  OR (
    public.company_access_allowed(auth.uid())
    AND company_id = public.get_user_company_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'rop'::app_role)
    )
  )
);

CREATE POLICY "Insert roles within company" ON public.user_roles
FOR INSERT WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (
    public.company_access_allowed(auth.uid())
    AND company_id = public.get_user_company_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'rop'::app_role)
    )
  )
);

CREATE POLICY "Delete roles within company" ON public.user_roles
FOR DELETE USING (
  public.is_super_admin(auth.uid())
  OR (
    public.company_access_allowed(auth.uid())
    AND company_id = public.get_user_company_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'rop'::app_role)
    )
  )
);
