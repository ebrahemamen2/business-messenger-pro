
ALTER TABLE public.shipment_tracking
  ADD COLUMN IF NOT EXISTS customer_address text,
  ADD COLUMN IF NOT EXISTS customer_area text,
  ADD COLUMN IF NOT EXISTS order_details text,
  ADD COLUMN IF NOT EXISTS amount numeric,
  ADD COLUMN IF NOT EXISTS status_description text,
  ADD COLUMN IF NOT EXISTS pickup_date text,
  ADD COLUMN IF NOT EXISTS status_date text,
  ADD COLUMN IF NOT EXISTS final_status text,
  ADD COLUMN IF NOT EXISTS last_status_date text,
  ADD COLUMN IF NOT EXISTS proc_notes text;
