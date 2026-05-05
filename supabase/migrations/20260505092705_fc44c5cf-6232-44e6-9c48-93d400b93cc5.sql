-- Add pending_review to event_status enum
ALTER TYPE event_status ADD VALUE IF NOT EXISTS 'pending_review';
ALTER TYPE event_status ADD VALUE IF NOT EXISTS 'rejected';

-- Allow public inserts on user_submitted_events (anyone can submit)
CREATE POLICY "Anyone can submit events"
ON public.user_submitted_events
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Performance index
CREATE INDEX IF NOT EXISTS idx_events_date_status ON public.events (event_date, status);
CREATE INDEX IF NOT EXISTS idx_events_dedup_hash ON public.events (dedup_hash);