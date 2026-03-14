-- Add chat_status column to conversations
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS chat_status text NOT NULL DEFAULT 'replied';

-- Backfill existing conversations based on actual last message direction
UPDATE public.conversations c
SET chat_status = CASE
  WHEN latest.direction = 'inbound' THEN 'unread'
  WHEN latest.direction IN ('outbound', 'store') THEN 'replied'
  ELSE 'replied'
END
FROM (
  SELECT DISTINCT ON (m.contact_phone) 
    m.contact_phone, 
    m.direction,
    m.tenant_id
  FROM public.messages m
  ORDER BY m.contact_phone, m.created_at DESC
) latest
WHERE c.contact_phone = latest.contact_phone
AND (c.tenant_id = latest.tenant_id OR (c.tenant_id IS NULL AND latest.tenant_id IS NULL));

-- Create index for fast filtering
CREATE INDEX IF NOT EXISTS idx_conversations_chat_status ON public.conversations(chat_status);