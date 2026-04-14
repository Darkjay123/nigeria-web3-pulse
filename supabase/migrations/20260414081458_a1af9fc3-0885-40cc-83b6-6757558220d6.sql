
-- Create user_submitted_events table
CREATE TABLE public.user_submitted_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link text,
  raw_text text,
  normalized_title text,
  normalized_date date,
  dedup_hash text,
  submission_count integer NOT NULL DEFAULT 1,
  submitted_by text[] DEFAULT '{}',
  processed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_submitted_events_dedup ON public.user_submitted_events (dedup_hash);
CREATE INDEX idx_user_submitted_events_processed ON public.user_submitted_events (processed);

ALTER TABLE public.user_submitted_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Submitted events are publicly readable"
ON public.user_submitted_events FOR SELECT USING (true);

-- Add submission_count and popularity_score to events table
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS submission_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS popularity_score numeric DEFAULT 0;
