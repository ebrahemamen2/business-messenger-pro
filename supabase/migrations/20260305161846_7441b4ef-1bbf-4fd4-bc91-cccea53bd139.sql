
-- Allow anon to SELECT messages
CREATE POLICY "Allow anon select messages"
ON public.messages FOR SELECT
TO anon
USING (true);

-- Allow anon to SELECT contacts
CREATE POLICY "Allow anon select contacts"
ON public.contacts FOR SELECT
TO anon
USING (true);

-- Allow anon to INSERT contacts (for upsert from webhook)
CREATE POLICY "Allow anon insert contacts"
ON public.contacts FOR INSERT
TO anon
WITH CHECK (true);

-- Allow anon to UPDATE contacts
CREATE POLICY "Allow anon update contacts"
ON public.contacts FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
