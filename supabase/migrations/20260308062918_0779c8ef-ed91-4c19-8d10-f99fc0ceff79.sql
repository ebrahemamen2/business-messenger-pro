
ALTER TABLE public.wa_config ADD COLUMN module text NOT NULL DEFAULT 'confirm';
ALTER TABLE public.auto_reply_rules ADD COLUMN module text NOT NULL DEFAULT 'confirm';
