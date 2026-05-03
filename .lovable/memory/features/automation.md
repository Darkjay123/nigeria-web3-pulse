---
name: Automation pipeline v9 — Discovery hardening + Luma via Firecrawl
description: v9 adds intent gate, signal scoring, future-date validation, AI anti-drift; replaces dead Luma API with Firecrawl search
type: feature
---
## Pipeline (v9)
```
Scrape → Normalize → Page Type Gate → Web3 Keyword → [DISCOVERY: Intent + Score≥2 + past-meta-date] → AI → Final Validator (past-date, anti-drift, conf≥0.85) → Dedup → Insert
```

## v9 Changes
- **Discovery intent gate** — `EVENT_INTENT_PATTERNS` (join us, rsvp, hosting, spaces, ama, workshop, hackathon, save the date, etc.). No intent → reject pre-AI.
- **Discovery signal score** — web3 + time + intent + platform; require ≥2.
- **Future-date validation** — `isPastDate()` checks AI-resolved or metadata date in `finalValidate`. Pre-AI short-circuit only on metadata dates (text regex too noisy in tweets).
- **AI anti-drift guard** — rejects reasons matching `/maybe|unclear|recap|past event|already happened|retrospective|history|throwback/`.
- **Confidence kept at 0.85** for both modes (proposal's 0.80 would loosen — rejected).
- **Luma fix** — `api.lu.ma/public/v2/event/search` is dead (404). Replaced with Firecrawl `/search` over `site:lu.ma <query>`, then `enrichLink` per real event page. Successfully discovered 15 lu.ma event pages in test.
- **Logging tags**: `[DISCOVERY PASS]`, `[DISCOVERY REJECT]`, `[AI ACCEPT DISCOVERY]`, `[AI REJECT DISCOVERY]`, `[ACCEPT]`, `[FINAL REJECT]`, `[GATE REJECT]`.

## Untouched
Structured strictness · Dedup logic · AI schema · 0.85 threshold · X dual-output discovery.
