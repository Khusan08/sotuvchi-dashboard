-- Add telegram_user_id to profiles for personal task reminders
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS telegram_user_id TEXT;

-- Add stock column to products if not exists (for inventory tracking)
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0;