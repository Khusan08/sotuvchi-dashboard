-- Add delivery_status column to leads table for tracking delivery after sale
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS delivery_status text DEFAULT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN public.leads.delivery_status IS 'Delivery status for sold leads: Jarayonda, Tasdiqlandi, Bekor bo''ldi';