
-- Create messages table for WhatsApp conversations
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wa_message_id TEXT UNIQUE,
  contact_phone TEXT NOT NULL,
  contact_name TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  body TEXT NOT NULL,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
  media_url TEXT,
  media_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create contacts table
CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  name TEXT,
  email TEXT,
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create auto_reply_rules table
CREATE TABLE public.auto_reply_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trigger_keyword TEXT NOT NULL,
  response_text TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create wa_config table for API settings
CREATE TABLE public.wa_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  access_token TEXT,
  phone_number_id TEXT,
  business_account_id TEXT,
  verify_token TEXT,
  welcome_message TEXT DEFAULT 'مرحباً بك! كيف يمكننا مساعدتك؟',
  away_message TEXT DEFAULT 'شكراً لتواصلك، سنرد عليك في أقرب وقت',
  welcome_enabled BOOLEAN DEFAULT true,
  away_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_reply_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_config ENABLE ROW LEVEL SECURITY;

-- For now, allow all authenticated users (single-tenant CRM)
CREATE POLICY "Allow all for authenticated" ON public.messages FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON public.contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON public.auto_reply_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON public.wa_config FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Allow service role (edge functions) full access
CREATE POLICY "Allow service role" ON public.messages FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role" ON public.contacts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role" ON public.auto_reply_rules FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role" ON public.wa_config FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Allow anon for webhook (Meta sends without auth)
CREATE POLICY "Allow anon insert messages" ON public.messages FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon select config" ON public.wa_config FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon select rules" ON public.auto_reply_rules FOR SELECT TO anon USING (true);

-- Index for fast message queries
CREATE INDEX idx_messages_contact ON public.messages(contact_phone, created_at DESC);
CREATE INDEX idx_messages_created ON public.messages(created_at DESC);

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_wa_config_updated_at BEFORE UPDATE ON public.wa_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
