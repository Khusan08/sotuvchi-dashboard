-- Add customer_phone2 column to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone2 TEXT;