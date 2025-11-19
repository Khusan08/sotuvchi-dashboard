-- user_roles table allaqachon mavjud, lekin trigger va boshqa policylarni qo'shamiz

-- Create function to automatically assign 'sotuvchi' role to new users
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Assign 'sotuvchi' role by default
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'sotuvchi');
  RETURN NEW;
END;
$$;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;

-- Trigger to automatically assign role on user creation
CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_role();

-- Update RLS policies for leads table
DROP POLICY IF EXISTS "Admins and ROPs can view all leads" ON public.leads;

CREATE POLICY "Admins and ROPs can view all leads"
ON public.leads
FOR SELECT
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'rop')
);

-- Update RLS policies for orders table
DROP POLICY IF EXISTS "Admins and ROPs can view all orders" ON public.orders;

CREATE POLICY "Admins and ROPs can view all orders"
ON public.orders
FOR SELECT
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'rop') OR
  auth.uid() = seller_id
);

-- Update RLS policies for tasks table
DROP POLICY IF EXISTS "Admins and ROPs can view all tasks" ON public.tasks;

CREATE POLICY "Admins and ROPs can view all tasks"
ON public.tasks
FOR SELECT
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'rop') OR
  auth.uid() = seller_id
);

-- Update RLS policies for order_items table
DROP POLICY IF EXISTS "Admins and ROPs can view all order items" ON public.order_items;

CREATE POLICY "Admins and ROPs can view all order items"
ON public.order_items
FOR SELECT
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'rop') OR
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = order_items.order_id
      AND orders.seller_id = auth.uid()
  )
);

-- Update RLS policies for profiles table
DROP POLICY IF EXISTS "Admins and ROPs can view all profiles" ON public.profiles;

CREATE POLICY "Admins and ROPs can view all profiles"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'rop') OR
  auth.uid() = id
);

-- Policy for user_roles: Admins and ROPs can delete roles
DROP POLICY IF EXISTS "Admins and ROPs can delete roles" ON public.user_roles;

CREATE POLICY "Admins and ROPs can delete roles"
ON public.user_roles
FOR DELETE
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'rop')
);