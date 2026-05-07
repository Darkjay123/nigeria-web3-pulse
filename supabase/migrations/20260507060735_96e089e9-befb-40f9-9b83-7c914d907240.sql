CREATE POLICY "Anyone can insert events"
ON public.events
FOR INSERT
TO anon, authenticated
WITH CHECK (true);