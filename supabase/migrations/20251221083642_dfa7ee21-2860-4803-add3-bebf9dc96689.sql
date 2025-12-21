-- Add call status field to leads table
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS call_status text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS call_duration integer;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS call_id text;

COMMENT ON COLUMN public.leads.call_status IS 'Qo''ng''iroq holati: answered, missed, busy, no_answer';
COMMENT ON COLUMN public.leads.call_duration IS 'Qo''ng''iroq davomiyligi sekundlarda';
COMMENT ON COLUMN public.leads.call_id IS 'My Zvonki qo''ng''iroq ID';