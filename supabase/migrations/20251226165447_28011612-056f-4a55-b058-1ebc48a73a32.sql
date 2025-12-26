-- Add unique constraint for user_roles to support upsert
ALTER TABLE public.user_roles 
ADD CONSTRAINT user_roles_user_id_role_company_id_key UNIQUE (user_id, role, company_id);