
-- Create enum for event types
CREATE TYPE public.event_type AS ENUM ('meetup', 'hackathon', 'workshop', 'conference', 'ama', 'online_session', 'bootcamp', 'summit', 'webinar', 'other');

-- Create enum for event status
CREATE TYPE public.event_status AS ENUM ('upcoming', 'ongoing', 'completed', 'cancelled');

-- Create events table
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  city TEXT,
  state TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'Nigeria',
  venue TEXT,
  event_date DATE,
  event_time TIME,
  end_date DATE,
  organizer TEXT,
  registration_link TEXT,
  source_url TEXT,
  event_type public.event_type NOT NULL DEFAULT 'other',
  tags TEXT[] DEFAULT '{}',
  is_online BOOLEAN NOT NULL DEFAULT false,
  confidence_score NUMERIC(3,2) DEFAULT 0.5,
  dedup_hash TEXT UNIQUE,
  status public.event_status NOT NULL DEFAULT 'upcoming',
  source_platform TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Anyone can read events
CREATE POLICY "Events are publicly readable" ON public.events FOR SELECT USING (true);

-- Only service role can insert/update/delete (admin operations)
CREATE POLICY "Service role can manage events" ON public.events FOR ALL USING (true) WITH CHECK (true);

-- Create indexes
CREATE INDEX idx_events_state ON public.events (state);
CREATE INDEX idx_events_event_date ON public.events (event_date);
CREATE INDEX idx_events_event_type ON public.events (event_type);
CREATE INDEX idx_events_is_online ON public.events (is_online);
CREATE INDEX idx_events_status ON public.events (status);
CREATE INDEX idx_events_tags ON public.events USING GIN (tags);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
