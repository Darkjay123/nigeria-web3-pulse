ALTER TABLE public.scrape_logs
  ADD COLUMN IF NOT EXISTS gate_rejections jsonb NOT NULL DEFAULT '{}'::jsonb;