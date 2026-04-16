---
name: Automation pipeline v5 — Page Type Gate + X Discovery + strict dedup
description: Production-grade pipeline with domain filtering, content rejection, fuzzy dedup, X/Twitter discovery, enhanced Telegram digests
type: feature
---
## Pipeline Architecture
- scrape-events: Luma, Eventbrite, Meetup (primary), X/Twitter discovery via Firecrawl search
- **Page Type Gate** (BEFORE AI): domain filter → content rejection → event structure validation
- **Hybrid filtering**: keyword pre-filter (score >= 2) → AI classification (gemini-2.5-flash-lite)
- Only events with AI relevant=true AND confidence >= 0.5 are inserted
- **Improved dedup**: normalized titles + fuzzy matching (token overlap >0.7) + same-link check + hash
- Max 30 events processed per run to prevent timeouts
- Community submissions: enriched via Firecrawl scrape → same pipeline

## Page Type Gate (Stage 0)
- Allowed domains: eventbrite, lu.ma, meetup, partiful, pretix, hopin, etc.
- Blocked domains: news sites, blogs, social media, Wikipedia
- Content rejection: list articles ("top", "best", "in this article", etc.)
- Event structure: requires 2+ signals (date, time, registration, venue)
- Unknown domains must pass structure check

## X/Twitter Discovery
- Firecrawl searches for tweets mentioning web3 events
- Extracts event links (Luma, Eventbrite, Meetup) from tweets
- Links enriched via Firecrawl scrape → full pipeline

## Telegram
- posted_to_telegram + posted_at columns on events table — no reposting
- telegram-notify: queries events WHERE posted_to_telegram = false
- /events command: supports sub-commands (today, week, month), up to 30 results
- Daily digest: auto-detects weekly (Sunday) and monthly (1st/15th) — Big Radar format
- Digests: daily (today + upcoming), weekly (grouped by date), monthly (by event type)

## Dedup
- normalizeTitle: strips "tickets", slugs, special chars
- Hash: SHA-256 of normalized title + date + state
- Fuzzy: token overlap similarity > 0.7 on same-date events
- Link dedup: same registration_link = duplicate

## Scheduling (pg_cron)
- Scrape: every 4 hours
- Notify: every 4 hours (10min offset)
- Daily summary: 8AM
- Poll: every 1 minute
