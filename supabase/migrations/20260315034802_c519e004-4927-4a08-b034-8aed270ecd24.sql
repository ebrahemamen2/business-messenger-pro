
-- Create followup_button_actions table
CREATE TABLE public.followup_button_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.followup_wa_templates(id) ON DELETE CASCADE,
  button_title TEXT NOT NULL,
  auto_reply_text TEXT NOT NULL DEFAULT '',
  update_status_to TEXT NOT NULL DEFAULT 'contacted',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique constraint: one action per button title per template
ALTER TABLE public.followup_button_actions ADD CONSTRAINT followup_button_actions_template_button_unique UNIQUE (template_id, button_title);

-- Enable RLS
ALTER TABLE public.followup_button_actions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Allow all for authenticated" ON public.followup_button_actions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role" ON public.followup_button_actions FOR ALL TO service_role USING (true) WITH CHECK (true);
