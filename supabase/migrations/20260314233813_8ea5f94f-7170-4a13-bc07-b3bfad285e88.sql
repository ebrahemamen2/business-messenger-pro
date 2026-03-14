
-- Orders table to store incoming orders from the store
CREATE TABLE public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  order_number text NOT NULL,
  customer_name text,
  customer_phone text NOT NULL,
  customer_city text,
  customer_address text,
  total_amount numeric(10,2),
  currency text DEFAULT 'SAR',
  items jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  order_source text DEFAULT 'store',
  notes text,
  store_order_id text,
  confirmation_message_sent boolean NOT NULL DEFAULT false,
  confirmed_at timestamp with time zone,
  conversation_id uuid REFERENCES public.conversations(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Order modifications log
CREATE TABLE public.order_modifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  modification_type text NOT NULL DEFAULT 'edit',
  old_data jsonb,
  new_data jsonb,
  message_sent boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_modifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON public.orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role" ON public.orders FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon select" ON public.orders FOR SELECT TO anon USING (true);

CREATE POLICY "Allow all for authenticated" ON public.order_modifications FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow service role" ON public.order_modifications FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Updated at trigger
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for orders
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
