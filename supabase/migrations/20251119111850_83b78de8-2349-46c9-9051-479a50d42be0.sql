-- Add order_number column with auto-increment
CREATE SEQUENCE IF NOT EXISTS orders_number_seq START 1;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number INTEGER DEFAULT nextval('orders_number_seq');

-- Set existing orders to have sequential numbers
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as rn
  FROM orders
)
UPDATE orders
SET order_number = numbered.rn
FROM numbered
WHERE orders.id = numbered.id;

-- Make order_number NOT NULL and set default
ALTER TABLE orders ALTER COLUMN order_number SET NOT NULL;
ALTER TABLE orders ALTER COLUMN order_number SET DEFAULT nextval('orders_number_seq');