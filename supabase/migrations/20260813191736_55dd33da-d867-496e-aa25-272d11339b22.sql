-- Retire legacy junk rows scraped before title hygiene existed
UPDATE public.events
SET status = 'rejected'
WHERE status <> 'rejected'
  AND (
    title ~* '/\s*Posts\s*/\s*X'
    OR title ~* '-\s*Twitter$'
    OR title ~* '\(@[A-Za-z0-9_]+\)'
    OR title ~* '\.\.\.$'
    OR title ~* '^(Are|Do|Is|Does|Can|Should|What|Why|How)\b.*\?'
  );

-- Tidy remaining titles
UPDATE public.events
SET title = btrim(regexp_replace(regexp_replace(title, '\s*[/|-]\s*(Posts|X|Twitter)\s*', ' ', 'gi'), '\s+', ' ', 'g'))
WHERE title ~* '(Posts|Twitter)';
