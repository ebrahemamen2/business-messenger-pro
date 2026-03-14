
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS last_customer_message_at timestamptz;

-- Backfill from most recent inbound message per conversation
UPDATE public.conversations c
SET last_customer_message_at = sub.last_inbound
FROM (
  SELECT m.contact_phone, MAX(m.created_at) AS last_inbound
  FROM public.messages m
  WHERE m.direction = 'inbound'
  GROUP BY m.contact_phone
) sub
WHERE c.contact_phone = sub.contact_phone
  AND c.last_customer_message_at IS NULL;
