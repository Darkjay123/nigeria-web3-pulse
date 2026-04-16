ALTER TABLE public.events ADD COLUMN IF NOT EXISTS posted_to_telegram boolean NOT NULL DEFAULT false;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS posted_at timestamptz DEFAULT null;

-- Backfill: mark events that were already posted
UPDATE public.events SET posted_to_telegram = true, posted_at = now()
WHERE id IN (SELECT event_id FROM public.telegram_posted_events);