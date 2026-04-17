---
name: Automation pipeline v6 — Strict 2-stage curator
description: Production-grade strict pipeline — hard filters + AI tool-calling classifier with confidence ≥ 0.85
type: feature
---
## Pipeline Architecture (STRICT)
- Sources: Luma JSON API, Eventbrite (JSON-LD), Meetup (JSON-LD), X/Twitter discovery, /submit
- Order per candidate:
  1. **Title minimum length** (≥ 5 chars)
  2. **Page Type Gate (hard filter, deterministic)** — rejects without AI cost:
     - Domain filter (allowed list / blocked list)
     - Listicle / blog detection (title patterns + body phrase count)
     - Event structure (≥ 2 of: specific date, time, registration, location)
     - MUST have a specific date (skipped only for whitelisted event platforms)
  3. **Web3 keyword pre-filter** (score ≥ 2)
  4. **AI Classifier (Stage 2)** — Gemini 2.5 Flash via tool calling
     - Returns: is_event, is_listicle, has_real_date, has_location, has_registration, is_online, confidence, reason
     - **ACCEPT only if**: is_event ∧ ¬is_listicle ∧ has_real_date ∧ (has_location ∨ is_online) ∧ has_registration ∧ confidence ≥ 0.85
  5. **Strict dedup**: hash + normalized URL match (registration_link OR source_url) + fuzzy title (token overlap > 0.7) on same date
  6. **Insert** with posted_to_telegram = false

## Firecrawl Role (NEVER decision-making)
- Enrich /submit links → markdown / metadata only
- Scrape X-discovered event links → raw text only
- All ACCEPT/REJECT decisions live in hard filters + AI

## Title Normalization (dedup-safe)
- Strips: "tickets", "register now", "rsvp", "free entry", "book now", "sign up"
- Removes punctuation, lowercases, collapses whitespace
- Used for dedup hash + fuzzy similarity

## URL Normalization (dedup-safe)
- Strips query, fragment, trailing slash
- Compares both registration_link and source_url

## Telegram
- posted_to_telegram + posted_at on events table — never reposts
- /events supports today / week / month sub-commands (≤30 results)
- Daily/weekly/monthly digests auto-detected by date

## Reset Policy
- Database cleared on v6 deployment to validate strict pipeline output
- Only events that pass ALL hard filters AND AI confidence ≥ 0.85 are inserted
