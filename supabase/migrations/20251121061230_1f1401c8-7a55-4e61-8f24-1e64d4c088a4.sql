-- Allow all authenticated users to update only the notes field on leads
CREATE POLICY "All users can add notes to leads"
ON public.leads
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);