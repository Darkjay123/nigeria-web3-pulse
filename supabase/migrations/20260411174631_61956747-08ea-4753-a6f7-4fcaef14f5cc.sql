
-- Drop the overly permissive policy
DROP POLICY "Service role can manage events" ON public.events;

-- No authenticated user policies needed - events are managed via service role (admin/server functions only)
-- The service role bypasses RLS entirely, so no explicit policy is needed for admin operations.
