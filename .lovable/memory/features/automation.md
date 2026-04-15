---
name: Automation pipeline v4 — Firecrawl + enriched submissions
description: Keyword pre-filter + AI classification + Firecrawl web-wide scraping + enriched community submissions
type: feature
---
## Pipeline Architecture
- scrape-events: Luma, Eventbrite, Meetup + Firecrawl web search scraping
- **Hybrid filtering**: keyword pre-filter (score >= 2) → AI classification (Lovable AI, gemini-2.5-flash-lite)
- Only events with AI relevant=true AND confidence >= 0.5 are inserted
- Failsafe: inserts system check event if 0 events found
- Community submissions: user_submitted_events table, /submit Telegram command
- Submissions enriched via Firecrawl scrape → same hybrid pipeline
- Dedup: SHA-256 hash of title+date+state
- Popularity: popularity_score = (submission_count * 0.4) + (confidence_score * 0.6)

## Sources
- Luma API + HTML fallback (16 query variations)
- Eventbrite JSON-LD + link fallback
- Meetup JSON-LD
- **Firecrawl search** (10 web-wide queries for web3/blockchain events in Nigeria/Africa)
- Community submissions via Telegram /submit

## Keyword Pre-Filter
- 60+ Web3 keywords
- Events must match >= 2 keywords to proceed to AI classification

## AI Classification
- Model: google/gemini-2.5-flash-lite
- Strict rules: reject generic tech, accept only core Web3 focus
- Outputs: relevant (bool), event_type, tags, state, city, event_date, confidence_score

## Submission Enrichment
- When user submits a link, Firecrawl scrapes the full page
- Extracted data (title, description, date, location) runs through same hybrid pipeline
- Only accepted if relevant=true AND confidence >= 0.5

## Admin Page
- Still exists at /admin route but removed from public navbar
- Only accessible via direct URL

## Telegram Functions
- telegram-notify: Posts unposted events to channel, ordered by popularity_score
- telegram-daily-summary: 8AM daily digest
- telegram-poll: Long-polling with /events, /today, /state, /online, /submit commands

## Scheduling (pg_cron)
- Scrape: every 4 hours
- Notify: every 4 hours (10min offset)
- Daily summary: 8AM
- Poll: every 1 minute
