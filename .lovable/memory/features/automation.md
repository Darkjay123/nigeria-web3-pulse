---
name: Automation pipeline v13 — free-first sources, parallel processing, in-memory dedup
description: v13 removes the hard Firecrawl dependency (the 402 that emptied the pipeline), adds keyless Luma/Meetup/JSON-LD sources, processes candidates 8-wide, skips the AI round-trip for trusted structured metadata, and replaces per-candidate dedup queries with a single preloaded index
type: feature
---
## Pipeline (v13)
```
Free sources (Luma city pages · Meetup search · JSON-LD calendars · Nitter) [parallel]
  + optional Firecrawl lane (X discovery, enrichment)
→ Normalize → cleanDisplayTitle → title gate → Page Type Gate → Web3 keyword
→ [trusted structured metadata? → FAST PATH, no AI]
→ [DISCOVERY: intent + score>=2] → AI → Final Validator → in-memory Dedup → Insert
```

## v13 changes
- **Firecrawl is no longer load-bearing.** v12 routed every source through it, so
  HTTP 402 meant zero events from every source. Sources now come from public
  endpoints with no key: lu.ma city pages (`__NEXT_DATA__`), Meetup search
  (`__NEXT_DATA__` Apollo cache), and any site publishing schema.org Event JSON-LD.
  Firecrawl runs the X lane and enrichment only; a 402 degrades one lane.
- **Dead scrapers replaced.** `scrapeEventbriteEvents` (HTTP 405 on the `/d/` path)
  and `scrapeMeetupEvents` (JSON-LD no longer on the find page) both returned 0.
- **Parallel processing.** Candidates run 8-wide through a bounded pool instead of
  strictly one at a time; cap raised from 50 to 120 per run.
- **Fast path.** Luma/Meetup/JSON-LD records already carry a machine-read date,
  location and link, so they skip the model round-trip. Discovery still goes to AI.
- **Dedup is in memory.** `isDuplicateEvent` fired up to 3 queries per candidate
  (one pulling 200 rows). The comparison set is now loaded once per run.
- **Free enrichment first** on user submissions: fetch the page and read its
  JSON-LD/OG tags, and fall back to Firecrawl only when that comes up empty.

## Frontend (v13)
- TanStack Query provider in `__root.tsx`; feed and stats cached per filter set.
- Filtering, sorting and limits run in Postgres (`useEvents`), not over a full
  table download in the browser. Only the columns the cards render are selected.
- `/` and `/events` share one `EventFeed`; `StatsBar` reads count queries.

## Untouched
v9 intent/signal gates · v10 title hygiene + gate telemetry · v11 pipeline_config
auto-tune + yield alerts · placeholder upgrade flow · UI design.
