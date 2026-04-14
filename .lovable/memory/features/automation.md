---
name: Automation pipeline v3 — hybrid filtering
description: Keyword pre-filter + AI classification for Web3 signal engine, scraping, dedup, Telegram delivery
type: feature
---
## Pipeline Architecture
- scrape-events: Luma, Eventbrite, Meetup scraping
- **Hybrid filtering**: keyword pre-filter (score >= 2) → AI classification (Lovable AI, gemini-2.5-flash-lite)
- Only events with AI relevant=true AND confidence >= 0.5 are inserted
- Failsafe: inserts system check event if 0 events found
- Community submissions: user_submitted_events table, /submit Telegram command
- Dedup: SHA-256 hash of title+date+state
- Popularity: popularity_score = (submission_count * 0.4) + (confidence_score * 0.6)

## Keyword Pre-Filter
- 60+ Web3 keywords: web3, blockchain, crypto, defi, nft, dao, ethereum, solana, zk, rollup, etc.
- Events must match >= 2 keywords to proceed to AI classification
- Fast rejection of generic tech events before any API call

## AI Classification
- Model: google/gemini-2.5-flash-lite (cheapest, fastest)
- Strict rules: reject generic tech, accept only core Web3 focus
- Outputs: relevant (bool), event_type, tags, state, city, event_date, confidence_score
- AI-enriched data used for event_type, tags, location, and confidence

## Telegram Functions
- telegram-notify: Posts unposted events to channel, ordered by popularity_score
- telegram-daily-summary: 8AM daily digest
- telegram-poll: Long-polling with /events, /today, /state, /online, /submit commands

## Scheduling (pg_cron)
- Scrape: every 4 hours
- Notify: every 4 hours (10min offset)
- Daily summary: 8AM
- Poll: every 1 minute
