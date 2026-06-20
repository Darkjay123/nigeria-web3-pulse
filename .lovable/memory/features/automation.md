---
name: Automation pipeline v10 — Gate telemetry, source-weighted confidence, title hygiene
description: v10 adds per-gate rejection counters, lowers confidence to 0.75 for trusted structured sources (luma/eventbrite/meetup/partiful), cleans tweet-cruft titles, rejects fragment titles
type: feature
---
## Pipeline (v10)
```
Scrape → Normalize → cleanDisplayTitle → isLowQualityTitle gate → Page Type Gate → Web3 Keyword → [DISCOVERY: Intent + Score≥2 + past-meta-date] → AI → Final Validator (source-weighted conf: 0.75 trusted / 0.85 discovery, past-date, anti-drift) → Dedup → Insert
```

## v10 Changes
- **Per-gate telemetry** — `scrape_logs.gate_rejections jsonb` records `{gate_name: count}`. `bumpGate(stats, name)` at every rejection. Gates: `title_too_short`, `low_quality_title`, `page_type:*`, `web3_keyword`, `discovery_no_intent`, `discovery_low_score`, `past_metadata_date`, `ai_unavailable`, `ai_failed`, `ai_not_event`, `ai_listicle`, `ai_uncertain`, `past_date`, `ai_low_confidence`, `no_date`, `no_location`, `no_registration`.
- **Source-weighted confidence** — `HIGH_TRUST = {luma, eventbrite, meetup, partiful}` → threshold 0.75. Others (x, x_discovery, community) → 0.85. Unblocks lu.ma drought (429 found / 0 inserted over 30d).
- **Title hygiene** — `cleanDisplayTitle()` strips `/ Posts / X`, `- Twitter`, `(@handle)`, caps at 140 chars. `isLowQualityTitle()` rejects question fragments <60 chars, mid-sentence ellipsis without event noun, profile-page titles.
- **finalValidate returns `gate`** for telemetry tagging.

## Untouched
v9 intent/signal gates · Dedup logic · Firecrawl scraping · X dual-output · placeholder upgrade flow · 0.85 discovery threshold.
