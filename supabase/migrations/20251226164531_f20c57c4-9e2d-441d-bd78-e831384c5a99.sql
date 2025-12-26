-- Update handle_new_user function to NOT create profile immediately
-- Profile will be created/updated by create-company function
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only insert if profile doesn't exist
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'seller')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update handle_new_user_role to NOT automatically add sotuvchi role
-- This prevents orphan roles without company_id
DROP FUNCTION IF EXISTS public.handle_new_user_role() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Don't auto-assign role here - let create-company or create-seller handle it
  -- This prevents creating roles without company_id
  RETURN NEW;
END;
$$;

-- Drop the trigger if it exists since we don't want auto role assignment
DROP TRIGGER IF EXISTS on_profile_created_add_role ON public.profiles;