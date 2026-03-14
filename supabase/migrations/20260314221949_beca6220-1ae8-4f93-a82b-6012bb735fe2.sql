
-- Shipment tracking table for follow-up module
CREATE TABLE public.shipment_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  shipment_code TEXT NOT NULL,
  order_code TEXT,
  customer_phone TEXT NOT NULL,
  customer_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  shipping_company TEXT,
  notes TEXT,
  wa_template_sent BOOLEAN NOT NULL DEFAULT false,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_shipment_tracking_tenant ON public.shipment_tracking(tenant_id);
CREATE INDEX idx_shipment_tracking_status ON public.shipment_tracking(tenant_id, status);
CREATE INDEX idx_shipment_tracking_shipment_code ON public.shipment_tracking(shipment_code);

-- RLS
ALTER TABLE public.shipment_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON public.shipment_tracking
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow service role" ON public.shipment_tracking
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Updated_at trigger
CREATE TRIGGER update_shipment_tracking_updated_at
  BEFORE UPDATE ON public.shipment_tracking
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
