
CREATE TABLE public.pipeline_config (
  source text PRIMARY KEY,
  ai_confidence_threshold numeric NOT NULL DEFAULT 0.75,
  min_threshold numeric NOT NULL DEFAULT 0.65,
  max_threshold numeric NOT NULL DEFAULT 0.90,
  last_tuned_at timestamptz,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pipeline_config TO anon, authenticated;
GRANT ALL ON public.pipeline_config TO service_role;
ALTER TABLE public.pipeline_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pipeline_config readable" ON public.pipeline_config FOR SELECT USING (true);

CREATE TABLE public.pipeline_alerts (
  source text PRIMARY KEY,
  last_alert_at timestamptz NOT NULL DEFAULT now(),
  reason text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);
GRANT SELECT ON public.pipeline_alerts TO anon, authenticated;
GRANT ALL ON public.pipeline_alerts TO service_role;
ALTER TABLE public.pipeline_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pipeline_alerts readable" ON public.pipeline_alerts FOR SELECT USING (true);

INSERT INTO public.pipeline_config (source, ai_confidence_threshold, min_threshold, max_threshold) VALUES
  ('luma',        0.75, 0.65, 0.90),
  ('eventbrite',  0.75, 0.65, 0.90),
  ('meetup',      0.75, 0.65, 0.90),
  ('partiful',    0.75, 0.65, 0.90),
  ('x',           0.85, 0.75, 0.92),
  ('x_discovery', 0.85, 0.75, 0.92),
  ('nitter',      0.85, 0.75, 0.92)
ON CONFLICT (source) DO NOTHING;
