-- Add stage column to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS stage text DEFAULT 'yengi_mijoz';

-- Update existing leads to have default stage based on their activity
UPDATE leads 
SET stage = CASE 
  WHEN activity = 'Sotildi' THEN 'sotildi'
  WHEN activity = 'Ko''tarmadi' OR activity = 'O''chirilgan' THEN 'kotarmagan'
  WHEN activity IS NOT NULL AND activity != '' THEN 'malumot_berildi'
  ELSE 'yengi_mijoz'
END
WHERE stage IS NULL OR stage = 'yengi_mijoz';