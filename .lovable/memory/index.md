# Project Memory

## Core
System: NextChain Radar — Web3 event intelligence for Nigeria.
Dark tech theme. Space Grotesk headings. Primary green #22c55e.
Lovable Cloud backend. Telegram connector linked. Firecrawl connector linked.
Do NOT modify frontend UI unless explicitly asked.
Admin page hidden from nav, accessible via direct URL only.
Fonts load via <link> in __root.tsx — never @import a remote URL in styles.css (breaks Tailwind v4 build).
Firecrawl is the only scraping provider; its credit balance gates the whole pipeline.

## Memories
- [Automation pipeline v12](mem://features/automation) — Firecrawl rate limiting, 402 provider-block detection, Nitter fixes, gate telemetry, auto-tuned thresholds
- [Database schema](mem://features/db-schema) — Events (with posted_to_telegram), telegram tracking, scrape logs, pipeline_config/alerts tables
