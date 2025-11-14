-- Create leads table
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  customer_email TEXT,
  source TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers can view own leads"
  ON public.leads FOR SELECT
  USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can create own leads"
  ON public.leads FOR INSERT
  WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers can update own leads"
  ON public.leads FOR UPDATE
  USING (auth.uid() = seller_id);

CREATE POLICY "Admins can view all leads"
  ON public.leads FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  image_url TEXT,
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view products"
  ON public.products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert products"
  ON public.products FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update products"
  ON public.products FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete products"
  ON public.products FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Triggers
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Public can view product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

CREATE POLICY "Admins can upload product images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'product-images' 
    AND has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Admins can update product images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'product-images' 
    AND has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    bucket_id = 'product-images' 
    AND has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Admins can delete product images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'product-images' 
    AND has_role(auth.uid(), 'admin'::app_role)
  );