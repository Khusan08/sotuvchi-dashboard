-- Fix task creation RLS policy to allow admins/ROPs to create tasks for sellers
DROP POLICY IF EXISTS "Users can create own tasks" ON tasks;
DROP POLICY IF EXISTS "Admins and ROPs can create tasks" ON tasks;

CREATE POLICY "Users can create own tasks" 
ON tasks 
FOR INSERT 
WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Admins and ROPs can create tasks for anyone" 
ON tasks 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'rop'::app_role)
);