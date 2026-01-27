-- Drop the broken triggers first
DROP TRIGGER IF EXISTS sync_lead_to_sheets_trigger ON public.leads;
DROP TRIGGER IF EXISTS sync_order_to_sheets_trigger ON public.orders;

-- Drop the broken functions
DROP FUNCTION IF EXISTS public.sync_lead_to_sheets();
DROP FUNCTION IF EXISTS public.sync_order_to_sheets();