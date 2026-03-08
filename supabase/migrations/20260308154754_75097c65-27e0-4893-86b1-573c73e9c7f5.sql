
-- 1. Add reply_to_message_id to messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS reply_to_message_id uuid REFERENCES public.messages(id);

-- 2. Conversations table for tracking status per phone
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_phone text NOT NULL,
  tenant_id uuid REFERENCES public.tenants(id),
  module text NOT NULL DEFAULT 'confirm',
  status text NOT NULL DEFAULT 'open',
  assigned_to uuid,
  unread_count integer NOT NULL DEFAULT 0,
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(contact_phone, tenant_id, module)
);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.conversations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon select" ON public.conversations FOR SELECT TO anon USING (true);
CREATE POLICY "Allow service role" ON public.conversations FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. Conversation labels
CREATE TABLE public.conversation_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#10b981',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.conversation_labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.conversation_labels FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon select" ON public.conversation_labels FOR SELECT TO anon USING (true);

-- 4. Label assignments
CREATE TABLE public.conversation_label_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  label_id uuid REFERENCES public.conversation_labels(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, label_id)
);
ALTER TABLE public.conversation_label_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.conversation_label_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon select" ON public.conversation_label_assignments FOR SELECT TO anon USING (true);

-- 5. Quick replies
CREATE TABLE public.quick_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  module text NOT NULL DEFAULT 'confirm',
  shortcut text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.quick_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.quick_replies FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon select" ON public.quick_replies FOR SELECT TO anon USING (true);

-- 6. Chat notes (internal team notes)
CREATE TABLE public.chat_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON public.chat_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7. Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_notes;
