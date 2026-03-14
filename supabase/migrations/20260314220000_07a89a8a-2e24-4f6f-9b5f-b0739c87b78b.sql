
-- 1. Remove module column from wa_config (unify per-tenant)
ALTER TABLE wa_config DROP COLUMN module;

-- 2. Add unique constraint on tenant_id for wa_config
ALTER TABLE wa_config ADD CONSTRAINT wa_config_tenant_unique UNIQUE (tenant_id);

-- 3. Create ai_config table
CREATE TABLE public.ai_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL DEFAULT 'lovable' CHECK (provider IN ('lovable', 'openai', 'google', 'anthropic')),
  api_key TEXT,
  model TEXT NOT NULL DEFAULT 'google/gemini-2.5-flash',
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT ai_config_tenant_unique UNIQUE (tenant_id)
);

-- 4. Create ai_module_prompts table
CREATE TABLE public.ai_module_prompts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  module TEXT NOT NULL CHECK (module IN ('confirm', 'followup', 'lost')),
  system_prompt TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT false,
  escalation_keywords TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT ai_module_prompts_tenant_module_unique UNIQUE (tenant_id, module)
);

-- 5. Enable RLS on new tables
ALTER TABLE public.ai_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_module_prompts ENABLE ROW LEVEL SECURITY;

-- 6. RLS policies for ai_config
CREATE POLICY "Allow all for authenticated" ON public.ai_config FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role" ON public.ai_config FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 7. RLS policies for ai_module_prompts  
CREATE POLICY "Allow all for authenticated" ON public.ai_module_prompts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role" ON public.ai_module_prompts FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 8. Update triggers for updated_at
CREATE TRIGGER update_ai_config_updated_at BEFORE UPDATE ON public.ai_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ai_module_prompts_updated_at BEFORE UPDATE ON public.ai_module_prompts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
