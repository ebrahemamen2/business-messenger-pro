
-- Create storage bucket for chat attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-attachments', 'chat-attachments', true);

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'chat-attachments');

-- Allow public read
CREATE POLICY "Public read access" ON storage.objects FOR SELECT TO public USING (bucket_id = 'chat-attachments');

-- Allow authenticated delete own
CREATE POLICY "Authenticated users can delete own" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'chat-attachments');
