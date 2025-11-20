-- Update default status for orders table to 'pending' (jarayonda)
ALTER TABLE public.orders 
ALTER COLUMN status SET DEFAULT 'pending';