-- Fix update_updated_at function to have proper search_path
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;