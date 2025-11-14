-- Add new fields to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS activity TEXT,
ADD COLUMN IF NOT EXISTS employee TEXT,
ADD COLUMN IF NOT EXISTS lead_type TEXT,
ADD COLUMN IF NOT EXISTS price NUMERIC;

-- Create order_items table for multiple products per order
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  price NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on order_items
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for order_items
CREATE POLICY "Users can view own order items"
ON public.order_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = order_items.order_id
    AND orders.seller_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all order items"
ON public.order_items
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own order items"
ON public.order_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = order_items.order_id
    AND orders.seller_id = auth.uid()
  )
);

-- Remove product-specific columns from orders table as they're now in order_items
ALTER TABLE public.orders 
DROP COLUMN IF EXISTS product_name,
DROP COLUMN IF EXISTS quantity,
DROP COLUMN IF EXISTS price;