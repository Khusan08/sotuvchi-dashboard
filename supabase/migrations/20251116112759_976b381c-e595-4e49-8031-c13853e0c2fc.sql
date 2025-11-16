-- Step 1: Convert column to text and update values
ALTER TABLE public.user_roles ALTER COLUMN role TYPE text;
UPDATE public.user_roles SET role = 'sotuvchi' WHERE role = 'seller';

-- Step 2: Drop and recreate the enum with correct values
DROP TYPE IF EXISTS app_role CASCADE;
CREATE TYPE app_role AS ENUM ('admin', 'rop', 'sotuvchi');

-- Step 3: Convert column back to enum
ALTER TABLE public.user_roles 
ALTER COLUMN role TYPE app_role USING role::app_role;

-- Step 4: Recreate has_role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Step 5: Update handle_new_user_role to assign 'sotuvchi' by default
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'sotuvchi');
  RETURN NEW;
END;
$$;

-- Step 6: Update RLS policies
DROP POLICY IF EXISTS "Admins can view all leads" ON public.leads;
CREATE POLICY "Admins and ROPs can view all leads" ON public.leads
FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'rop'::app_role)
);

DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
CREATE POLICY "Admins and ROPs can view all orders" ON public.orders
FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'rop'::app_role) OR
  auth.uid() = seller_id
);

DROP POLICY IF EXISTS "Admins can view all order items" ON public.order_items;
CREATE POLICY "Admins and ROPs can view all order items" ON public.order_items
FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'rop'::app_role) OR
  EXISTS (
    SELECT 1 FROM orders 
    WHERE orders.id = order_items.order_id 
    AND orders.seller_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins can view all tasks" ON public.tasks;
CREATE POLICY "Admins and ROPs can view all tasks" ON public.tasks
FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'rop'::app_role) OR
  auth.uid() = seller_id
);

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins and ROPs can view all profiles" ON public.profiles
FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'rop'::app_role) OR
  auth.uid() = id
);

DROP POLICY IF EXISTS "Admins can insert products" ON public.products;
CREATE POLICY "Admins and ROPs can insert products" ON public.products
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'rop'::app_role)
);

DROP POLICY IF EXISTS "Admins can update products" ON public.products;
CREATE POLICY "Admins and ROPs can update products" ON public.products
FOR UPDATE USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'rop'::app_role)
);

DROP POLICY IF EXISTS "Admins can delete products" ON public.products;
CREATE POLICY "Admins and ROPs can delete products" ON public.products
FOR DELETE USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'rop'::app_role)
);

DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
CREATE POLICY "Admins and ROPs can insert roles" ON public.user_roles
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'rop'::app_role)
);