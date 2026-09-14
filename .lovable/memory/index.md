# Project Memory

## Core
System: NextChain Radar — Web3 event intelligence for Nigeria.
Dark tech theme. Space Grotesk headings. Primary green #22c55e.
Lovable Cloud backend. Telegram connector linked. Firecrawl connector linked.
Do NOT modify frontend UI unless explicitly asked.
Admin page hidden from nav, accessible via direct URL only.
Fonts load via <link> in __root.tsx — never @import a remote URL in styles.css (breaks Tailwind v4 build).
Sources are free-first (Luma/Meetup/JSON-LD, no key). Firecrawl is optional enrichment only — a 402 degrades one lane, never the pipeline.

## Memories
- [Automation pipeline v13](mem://features/automation) — free-first sources, 8-wide parallel processing, AI fast path, in-memory dedup, cached server-side frontend queries
- [Database schema](mem://features/db-schema) — Events (with posted_to_telegram), telegram tracking, scrape logs, pipeline_config/alerts tables
