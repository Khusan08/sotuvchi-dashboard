-- Add region, district and notes columns to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS district TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT;