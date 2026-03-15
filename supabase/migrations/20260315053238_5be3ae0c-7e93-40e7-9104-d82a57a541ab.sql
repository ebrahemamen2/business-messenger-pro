
CREATE TABLE public.shipment_followup_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid REFERENCES public.shipment_tracking(id) ON DELETE CASCADE NOT NULL,
  tenant_id uuid REFERENCES public.tenants(id) NOT NULL,
  action_status text NOT NULL DEFAULT 'pending',
  notes text,
  final_status_snapshot text,
  done_status text NOT NULL DEFAULT 'pending',
  done_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shipment_followup_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON public.shipment_followup_history FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role" ON public.shipment_followup_history FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX idx_followup_history_shipment ON public.shipment_followup_history(shipment_id);
CREATE INDEX idx_followup_history_tenant ON public.shipment_followup_history(tenant_id);
CREATE INDEX idx_followup_history_created ON public.shipment_followup_history(created_at DESC);
