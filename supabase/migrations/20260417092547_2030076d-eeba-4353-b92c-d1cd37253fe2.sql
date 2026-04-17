-- Clear all events for fresh strict pipeline test
DELETE FROM public.telegram_posted_events;
DELETE FROM public.events;
-- Also reset user submissions to be re-processed under new pipeline
UPDATE public.user_submitted_events SET processed = false;