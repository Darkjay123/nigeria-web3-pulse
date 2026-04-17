---
name: Automation pipeline v7 — Normalizer + Single Validator
description: v7 strict pipeline with metadata-aware date validation, single final validator, and normalizer layer
type: feature
---
## Pipeline Architecture (v7)
```
Scraper → NORMALIZER → Stage 1 Gate → Keyword → AI Classifier → FINAL VALIDATOR → Dedup → Insert
```

## Key v7 Fixes
1. **Normalizer (NEW)** — `normalizeEvent(raw)` runs FIRST. Produces uniform `NormalizedEvent` shape with `event_date` resolved from EITHER metadata OR text, plus `has_metadata_date` flag. Fixes Luma false-rejects.
2. **Metadata-aware Page Type Gate** — date requirement now satisfied by `structure.hasDate || ev.has_metadata_date || ev.event_date`. No more rejecting valid Luma events whose date lives in API metadata.
3. **Single Final Validator** — `finalValidate(ev, ai)` is the ONLY place enforcement happens (date / location / registration / confidence). AI is classification-only. Eliminates "AI says yes, pipeline says no" bugs.
4. **Tightened listicle detection** — strong title regex first; body-phrase check requires ≥3 hits AND no single-event identifier (registration verb + date proximity). Fixes false-rejects like "Web3 Meetup in Lagos: Agenda + Speakers".
5. **Cross-platform fuzzy dedup fallback** — when no date, compares against last 200 events with strict similarity > 0.85.

## Stages
1. **Normalize** — uniform shape, metadata date extraction
2. **Page Type Gate** (deterministic): domain filter, listicle detection, structure ≥2 signals, metadata-aware date
3. **Web3 keyword pre-filter** (score ≥ 2)
4. **AI Classifier** — Gemini 2.5 Flash via tool calling, returns classification signals only
5. **Final Validator** — single source of truth: AI confidence ≥ 0.85, resolvable date, location/online, registration
6. **Dedup** — hash + URL match (registration_link OR source_url) + fuzzy title (>0.7 same date, >0.85 cross-platform)
7. **Insert** with posted_to_telegram = false

## Firecrawl Role
- Enrich /submit links → markdown / metadata only
- Scrape X-discovered event links → raw text only
- NEVER decision-making

## Telegram
- posted_to_telegram + posted_at on events table — never reposts
- /events supports today / week / month sub-commands (≤30 results)
- Daily/weekly/monthly digests auto-detected by date
