---
name: Automation pipeline v12 — Firecrawl rate limiting, provider-block detection, Nitter hardening
description: v12 fixes the syntax error that blocked v11 deploys, serializes all Firecrawl calls behind a 14 req/min queue, detects HTTP 402 credit exhaustion, treats nitter as a discovery source, and rejects fake "not whitelisted" RSS feeds
type: feature
---
## Pipeline (v12)
```
Scrape (rate-limited Firecrawl queue) → Normalize → cleanDisplayTitle → title gate → Page Type Gate (structured|discovery) → Web3 keyword → [DISCOVERY: intent + score≥2 + past-meta-date] → AI → Final Validator (per-source threshold from pipeline_config) → Dedup → Insert
```

## v12 Changes
- **Deploy blocker fixed** — `scrape_logs` insert block was missing `});`, so the whole v11 feature set (auto-tune, Nitter, telemetry) never shipped.
- **Firecrawl rate limiter** — `fcRequest(path, body, key)` serializes ALL Firecrawl traffic with a 4.3s gap (~14 req/min) plus one 429 backoff retry. Parallel fan-out previously 429'd every call, so every source reported `found=0`. Query counts trimmed (Luma 4, X 4) to fit the budget; X no longer does two searches per query.
- **Provider-block detection** — HTTP 402 sets `fcState.outOfCredits`, aborts remaining scraping, writes a `pipeline_alerts` row (`reason='provider_out_of_credits'`), returns `provider_blocked` in the response, and SKIPS auto-tuning so thresholds don't drift on meaningless zero-yield runs.
- **`nitter` is a discovery platform** — was classified structured, so every candidate died as `page_type:blocked domain` (x.com).
- **Nitter guard** — instances (xcancel etc.) answer HTTP 200 with "RSS reader not yet whitelisted!"; that body is now treated as a failure instead of 5 fake events.

## Known external constraint
Firecrawl credits are exhausted (HTTP 402). No source can yield events until the plan is topped up — code-side gates are not the current bottleneck.

## Untouched
v9 intent/signal gates · v10 title hygiene + gate telemetry · v11 pipeline_config auto-tune + yield alerts · Dedup logic · placeholder upgrade flow.
