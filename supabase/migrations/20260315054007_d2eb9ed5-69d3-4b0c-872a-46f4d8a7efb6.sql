
UPDATE public.shipment_tracking
SET status = 'pending'
WHERE status NOT IN ('pending', 'contacted', 'resolved', 'escalated', 'cancelled');
