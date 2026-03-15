
CREATE TABLE public.followup_status_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  followup_statuses text[] NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(tenant_id)
);

ALTER TABLE public.followup_status_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON public.followup_status_config
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow service role" ON public.followup_status_config
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Add unique constraint on shipment_code + tenant_id for upsert support
ALTER TABLE public.shipment_tracking ADD CONSTRAINT shipment_tracking_code_tenant_unique UNIQUE (shipment_code, tenant_id);
