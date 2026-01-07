-- Add normalized phone column for leads
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS customer_phone_norm TEXT;

-- Backfill existing rows
UPDATE public.leads
SET customer_phone_norm = NULLIF(regexp_replace(customer_phone, '\D', '', 'g'), '')
WHERE customer_phone IS NOT NULL;

-- Speed up duplicate checks
CREATE INDEX IF NOT EXISTS idx_leads_company_phone_norm
ON public.leads (company_id, customer_phone_norm);

-- Normalize phone + prevent duplicates within same company
CREATE OR REPLACE FUNCTION public.leads_normalize_and_validate_phone()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Normalize phone
  IF NEW.customer_phone IS NULL THEN
    NEW.customer_phone_norm := NULL;
  ELSE
    NEW.customer_phone_norm := NULLIF(regexp_replace(NEW.customer_phone, '\D', '', 'g'), '');
  END IF;

  -- If we don't have enough data, allow
  IF NEW.company_id IS NULL OR NEW.customer_phone_norm IS NULL THEN
    RETURN NEW;
  END IF;

  -- Prevent duplicates within company
  IF TG_OP = 'INSERT' THEN
    IF EXISTS (
      SELECT 1
      FROM public.leads l
      WHERE l.company_id = NEW.company_id
        AND l.customer_phone_norm = NEW.customer_phone_norm
      LIMIT 1
    ) THEN
      RAISE EXCEPTION 'PHONE_ALREADY_EXISTS';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF EXISTS (
      SELECT 1
      FROM public.leads l
      WHERE l.company_id = NEW.company_id
        AND l.customer_phone_norm = NEW.customer_phone_norm
        AND l.id <> NEW.id
      LIMIT 1
    ) THEN
      RAISE EXCEPTION 'PHONE_ALREADY_EXISTS';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leads_phone_norm_validate ON public.leads;
CREATE TRIGGER trg_leads_phone_norm_validate
BEFORE INSERT OR UPDATE OF customer_phone, company_id ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.leads_normalize_and_validate_phone();
