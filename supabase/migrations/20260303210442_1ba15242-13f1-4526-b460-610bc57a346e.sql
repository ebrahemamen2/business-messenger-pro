
-- Add permissive anon INSERT and UPDATE policies for wa_config
CREATE POLICY "Allow anon insert config"
ON public.wa_config FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Allow anon update config"
ON public.wa_config FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);
