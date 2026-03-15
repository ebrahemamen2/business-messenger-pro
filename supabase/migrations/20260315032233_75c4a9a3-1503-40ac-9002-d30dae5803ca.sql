
-- Add WA template tracking columns to shipment_tracking
ALTER TABLE public.shipment_tracking 
  ADD COLUMN IF NOT EXISTS wa_template_name text,
  ADD COLUMN IF NOT EXISTS wa_sent_at timestamp with time zone;

-- Create followup WA templates table
CREATE TABLE public.followup_wa_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  template_name text NOT NULL,
  language text NOT NULL DEFAULT 'ar',
  description text,
  has_variables boolean NOT NULL DEFAULT false,
  variable_mappings jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, template_name)
);

ALTER TABLE public.followup_wa_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON public.followup_wa_templates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow service role" ON public.followup_wa_templates
  FOR ALL TO service_role USING (true) WITH CHECK (true);
