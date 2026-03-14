ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS pinned_at timestamptz DEFAULT NULL;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS archived_at timestamptz DEFAULT NULL;