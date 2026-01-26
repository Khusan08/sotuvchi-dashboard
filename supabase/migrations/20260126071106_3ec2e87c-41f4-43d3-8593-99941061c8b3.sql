-- Create function to sync leads to Google Sheets
CREATE OR REPLACE FUNCTION public.sync_lead_to_sheets()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  seller_name TEXT;
  payload JSONB;
BEGIN
  -- Get seller name
  SELECT full_name INTO seller_name 
  FROM profiles 
  WHERE id = NEW.seller_id;

  -- Build payload
  payload := jsonb_build_object(
    'type', 'lead',
    'record', jsonb_build_object(
      'id', NEW.id,
      'customer_name', NEW.customer_name,
      'customer_phone', NEW.customer_phone,
      'customer_email', NEW.customer_email,
      'activity', NEW.activity,
      'source', NEW.source,
      'stage', NEW.stage,
      'lead_quality', NEW.lead_quality,
      'notes', NEW.notes,
      'price', NEW.price,
      'seller_name', seller_name,
      'created_at', NEW.created_at,
      'updated_at', NEW.updated_at
    )
  );

  -- Call edge function asynchronously
  PERFORM net.http_post(
    url := (SELECT value FROM vault.secrets WHERE name = 'SUPABASE_URL' LIMIT 1) || '/functions/v1/sync-to-sheets',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM vault.secrets WHERE name = 'SUPABASE_ANON_KEY' LIMIT 1)
    ),
    body := payload
  );

  RETURN NEW;
END;
$$;

-- Create function to sync orders to Google Sheets
CREATE OR REPLACE FUNCTION public.sync_order_to_sheets()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  seller_name TEXT;
  payload JSONB;
BEGIN
  -- Get seller name
  SELECT full_name INTO seller_name 
  FROM profiles 
  WHERE id = NEW.seller_id;

  -- Build payload
  payload := jsonb_build_object(
    'type', 'order',
    'record', jsonb_build_object(
      'id', NEW.id,
      'order_number', NEW.order_number,
      'customer_name', NEW.customer_name,
      'customer_phone', NEW.customer_phone,
      'region', NEW.region,
      'district', NEW.district,
      'status', NEW.status,
      'total_amount', NEW.total_amount,
      'advance_payment', NEW.advance_payment,
      'notes', NEW.notes,
      'seller_name', seller_name,
      'order_date', NEW.order_date,
      'created_at', NEW.created_at,
      'updated_at', NEW.updated_at
    )
  );

  -- Call edge function asynchronously
  PERFORM net.http_post(
    url := (SELECT value FROM vault.secrets WHERE name = 'SUPABASE_URL' LIMIT 1) || '/functions/v1/sync-to-sheets',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM vault.secrets WHERE name = 'SUPABASE_ANON_KEY' LIMIT 1)
    ),
    body := payload
  );

  RETURN NEW;
END;
$$;

-- Create triggers for leads
DROP TRIGGER IF EXISTS sync_lead_to_sheets_trigger ON leads;
CREATE TRIGGER sync_lead_to_sheets_trigger
  AFTER INSERT OR UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION sync_lead_to_sheets();

-- Create triggers for orders
DROP TRIGGER IF EXISTS sync_order_to_sheets_trigger ON orders;
CREATE TRIGGER sync_order_to_sheets_trigger
  AFTER INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION sync_order_to_sheets();