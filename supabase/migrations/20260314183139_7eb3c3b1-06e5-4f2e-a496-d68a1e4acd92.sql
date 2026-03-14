
-- Add last_message_body column
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS last_message_body text;

-- Backfill from messages
UPDATE public.conversations c
SET last_message_body = (
  SELECT m.body FROM public.messages m
  WHERE m.contact_phone = c.contact_phone
  AND (m.tenant_id = c.tenant_id OR m.tenant_id IS NULL)
  ORDER BY m.created_at DESC
  LIMIT 1
);

-- Trigger to auto-update last_message_body
CREATE OR REPLACE FUNCTION public.update_conversation_last_message_body()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE conversations
  SET last_message_body = NEW.body,
      last_message_at = NEW.created_at
  WHERE contact_phone = NEW.contact_phone
    AND (tenant_id = NEW.tenant_id OR (tenant_id IS NULL AND NEW.tenant_id IS NULL));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_conv_last_msg_body ON public.messages;
CREATE TRIGGER trg_update_conv_last_msg_body
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_last_message_body();
