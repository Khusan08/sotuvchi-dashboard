-- Add telegram_message_id to orders table to track sent messages
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS telegram_message_id bigint;