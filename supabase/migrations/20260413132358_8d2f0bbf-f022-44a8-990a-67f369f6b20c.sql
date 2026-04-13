
-- Table to track Telegram getUpdates polling offset
CREATE TABLE public.telegram_bot_state (
  id int PRIMARY KEY CHECK (id = 1),
  update_offset bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.telegram_bot_state (id, update_offset) VALUES (1, 0);

ALTER TABLE public.telegram_bot_state ENABLE ROW LEVEL SECURITY;

-- Table to track which events have been posted to Telegram
CREATE TABLE public.telegram_posted_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  posted_at timestamptz NOT NULL DEFAULT now(),
  message_id bigint,
  UNIQUE(event_id)
);

ALTER TABLE public.telegram_posted_events ENABLE ROW LEVEL SECURITY;

-- Table for incoming Telegram messages (bot commands)
CREATE TABLE public.telegram_messages (
  update_id bigint PRIMARY KEY,
  chat_id bigint NOT NULL,
  text text,
  raw_update jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_telegram_messages_chat_id ON public.telegram_messages (chat_id);

ALTER TABLE public.telegram_messages ENABLE ROW LEVEL SECURITY;

-- Table for scrape run logs
CREATE TABLE public.scrape_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  events_found int NOT NULL DEFAULT 0,
  events_inserted int NOT NULL DEFAULT 0,
  duplicates_skipped int NOT NULL DEFAULT 0,
  errors text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.scrape_logs ENABLE ROW LEVEL SECURITY;

-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
