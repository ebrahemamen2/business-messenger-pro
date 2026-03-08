
CREATE TABLE public.webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  event_type text NOT NULL DEFAULT 'unknown',
  phones text[] DEFAULT '{}',
  message_count integer DEFAULT 0,
  payload_summary jsonb,
  error text,
  status text NOT NULL DEFAULT 'ok'
);

ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon select webhook_logs" ON public.webhook_logs FOR SELECT USING (true);
CREATE POLICY "Allow service role all webhook_logs" ON public.webhook_logs FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_webhook_logs_created_at ON public.webhook_logs (created_at DESC);
