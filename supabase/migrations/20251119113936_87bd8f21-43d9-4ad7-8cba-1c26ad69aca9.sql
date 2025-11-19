-- Allow all authenticated users to manage products
DROP POLICY IF EXISTS "Admins and ROPs can insert products" ON products;
DROP POLICY IF EXISTS "Admins and ROPs can update products" ON products;
DROP POLICY IF EXISTS "Admins and ROPs can delete products" ON products;

CREATE POLICY "Authenticated users can insert products"
ON products FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update products"
ON products FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete products"
ON products FOR DELETE
TO authenticated
USING (true);