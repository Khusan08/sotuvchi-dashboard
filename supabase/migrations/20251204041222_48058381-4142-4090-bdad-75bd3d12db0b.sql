-- Add stock column to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock integer DEFAULT 0;

-- Add action_status column to leads table (separate from activity/foliyat turi)
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS action_status text;