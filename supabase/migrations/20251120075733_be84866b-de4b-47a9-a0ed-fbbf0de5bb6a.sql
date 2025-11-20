-- Add lead_quality column to leads table
ALTER TABLE public.leads 
ADD COLUMN lead_quality TEXT DEFAULT 'Lid sifati';

-- Add a check constraint for valid values
ALTER TABLE public.leads
ADD CONSTRAINT leads_lead_quality_check 
CHECK (lead_quality IN ('Lid sifati', 'Ko''tarmadi', 'O''chirilgan'));