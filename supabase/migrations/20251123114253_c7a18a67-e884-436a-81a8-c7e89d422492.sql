-- Add lead_id to tasks table to link tasks with leads
ALTER TABLE public.tasks ADD COLUMN lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE;

-- Create stages table for dynamic stage management
CREATE TABLE public.stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  display_order integer NOT NULL,
  color text NOT NULL DEFAULT 'bg-blue-500',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on stages table
ALTER TABLE public.stages ENABLE ROW LEVEL SECURITY;

-- Everyone can view stages
CREATE POLICY "Everyone can view stages"
ON public.stages
FOR SELECT
USING (true);

-- Only admins and ROPs can insert stages
CREATE POLICY "Admins and ROPs can insert stages"
ON public.stages
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rop'::app_role));

-- Only admins and ROPs can update stages
CREATE POLICY "Admins and ROPs can update stages"
ON public.stages
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rop'::app_role));

-- Only admins and ROPs can delete stages
CREATE POLICY "Admins and ROPs can delete stages"
ON public.stages
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'rop'::app_role));

-- Insert default stages
INSERT INTO public.stages (name, display_order, color) VALUES
  ('Yengi Mijoz', 1, 'bg-blue-500'),
  ('Ko''tarmagan', 2, 'bg-orange-500'),
  ('Ma''lumot berildi', 3, 'bg-purple-500'),
  ('Sotildi', 4, 'bg-green-500');

-- Create lead_comments table for commenting on leads
CREATE TABLE public.lead_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on lead_comments table
ALTER TABLE public.lead_comments ENABLE ROW LEVEL SECURITY;

-- Users can view comments on leads they have access to
CREATE POLICY "Users can view lead comments"
ON public.lead_comments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.leads
    WHERE leads.id = lead_comments.lead_id
    AND (
      has_role(auth.uid(), 'admin'::app_role) 
      OR has_role(auth.uid(), 'rop'::app_role)
      OR leads.seller_id = auth.uid()
    )
  )
);

-- Users can add comments to leads they have access to
CREATE POLICY "Users can add lead comments"
ON public.lead_comments
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.leads
    WHERE leads.id = lead_comments.lead_id
    AND (
      has_role(auth.uid(), 'admin'::app_role) 
      OR has_role(auth.uid(), 'rop'::app_role)
      OR leads.seller_id = auth.uid()
    )
  )
);

-- Add trigger for stages updated_at
CREATE TRIGGER update_stages_updated_at
BEFORE UPDATE ON public.stages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();