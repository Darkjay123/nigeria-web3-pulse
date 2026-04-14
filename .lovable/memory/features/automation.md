---
name: Automation pipeline v2
description: Scraping, community submissions, dedup, popularity scoring, Telegram delivery
type: feature
---
## Pipeline Architecture
- scrape-events: Luma, Eventbrite, Meetup scraping with relaxed filters (test mode)
- Failsafe: inserts system check event if 0 events found
- Community submissions: user_submitted_events table, /submit Telegram command
- Dedup: SHA-256 hash of title+date+state
- Popularity: popularity_score = (submission_count * 0.4) + (confidence_score * 0.6)

## Telegram Functions
- telegram-notify: Posts unposted events to channel, ordered by popularity_score
- telegram-daily-summary: 8AM daily digest
- telegram-poll: Long-polling with /events, /today, /state, /online, /submit commands

## Scheduling (pg_cron)
- Scrape: every 4 hours
- Notify: every 4 hours (10min offset)
- Daily summary: 8AM
- Poll: every 1 minute

## Key fixes applied
- telegram-notify: Fixed broken .not('id','in', subquery) → separate query for posted IDs
- scraper: Relaxed nigeriaRelated filter to true (test mode)
- Added submission_count + popularity_score columns to events table
