import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============ CONSTANTS ============

const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue",
  "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu",
  "FCT Abuja", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina",
  "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo",
  "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara"
];

const STATE_CITIES: Record<string, string[]> = {
  "Lagos": ["lagos", "ikeja", "lekki", "victoria island", "vi", "ikoyi", "surulere", "yaba", "ojuelegba", "ajah", "festac"],
  "FCT Abuja": ["abuja", "fct", "wuse", "garki", "maitama", "asokoro", "gwarinpa"],
  "Rivers": ["port harcourt", "ph", "rivers"],
  "Oyo": ["ibadan", "oyo"],
  "Kano": ["kano"],
  "Kaduna": ["kaduna"],
  "Enugu": ["enugu"],
  "Delta": ["warri", "asaba", "delta"],
  "Anambra": ["awka", "onitsha", "nnewi", "anambra"],
  "Edo": ["benin city", "benin", "edo"],
  "Ogun": ["abeokuta", "ogun"],
  "Osun": ["osogbo", "ife", "osun"],
  "Ondo": ["akure", "ondo"],
  "Ekiti": ["ado ekiti", "ekiti"],
  "Cross River": ["calabar", "cross river"],
  "Plateau": ["jos", "plateau"],
  "Benue": ["makurdi", "benue"],
  "Kwara": ["ilorin", "kwara"],
  "Nasarawa": ["lafia", "nasarawa"],
  "Niger": ["minna", "niger"],
};

const EVENT_TYPE_KEYWORDS: Record<string, string[]> = {
  "meetup": ["meetup", "meet up", "gathering", "mixer"],
  "hackathon": ["hackathon", "hack", "buildathon", "build-a-thon"],
  "workshop": ["workshop", "hands-on", "training", "tutorial"],
  "conference": ["conference", "conf", "summit", "forum"],
  "ama": ["ama", "ask me anything", "q&a", "qa session"],
  "online_session": ["webinar", "online session", "virtual event", "twitter space", "x space"],
  "bootcamp": ["bootcamp", "boot camp", "intensive"],
  "summit": ["summit"],
  "webinar": ["webinar"],
};

// ============ WEB3 KEYWORD PRE-FILTER ============

const WEB3_KEYWORDS = [
  "web3", "blockchain", "crypto", "cryptocurrency", "defi", "nft", "dao",
  "smart contract", "ethereum", "bitcoin", "layer 2", "layer2", "l2",
  "zk", "zero knowledge", "rollup", "token", "tokenomics", "wallet",
  "onchain", "on-chain", "stablecoin", "solidity", "dapp", "dapps",
  "decentralized", "decentralised", "consensus", "mining", "staking",
  "yield", "liquidity", "amm", "dex", "cefi", "metaverse", "gamefi",
  "play to earn", "move to earn", "soulbound", "airdrop", "ido", "ico",
  "launchpad", "bridge", "cross-chain", "crosschain", "multichain",
  "polygon", "solana", "bnb chain", "avalanche", "arbitrum", "optimism",
  "base chain", "sui", "aptos", "cosmos", "polkadot", "near protocol",
  "chainlink", "uniswap", "opensea", "metamask", "ledger",
];

function web3KeywordScore(text: string): number {
  const lower = text.toLowerCase();
  let score = 0;
  for (const kw of WEB3_KEYWORDS) {
    if (lower.includes(kw)) score++;
  }
  return score;
}

// ============ PAGE TYPE GATE ============

const ALLOWED_EVENT_DOMAINS = [
  "eventbrite.com", "lu.ma", "meetup.com", "partiful.com",
  "pretix.eu", "hopin.com", "luma.com", "events.com",
  "konfhub.com", "airmeet.com", "guild.host",
];

const BLOCKED_DOMAINS = [
  "punchng.com", "medium.com", "blog.", "news.", "techpoint.africa",
  "disrupt-africa.com", "venturesafrica.com", "nairametrics.com",
  "guardian.ng", "vanguardngr.com", "thecable.ng", "premiumtimesng.com",
  "channelstv.com", "bbc.com", "cnn.com", "reuters.com",
  "wikipedia.org", "youtube.com", "facebook.com", "linkedin.com",
  "reddit.com", "quora.com", "twitter.com", "x.com",
];

const LIST_ARTICLE_PHRASES = [
  "list of", "in this article", "here are",
  "upcoming events in", "about us", "our team", "privacy policy",
  "terms of service", "cookie policy", "subscribe to", "sign up for our",
  "read more", "related articles", "you might also like",
  "table of contents", "written by", "published on",
  "share this", "comments section",
  "things to do", "events this week", "we've compiled", "we have compiled",
  "roundup", "round-up", "ultimate guide", "complete guide",
  "check out these", "must attend", "must-attend",
];

// Title-only blacklist patterns (listicle / blog signals)
const LISTICLE_TITLE_PATTERNS = [
  /^\s*top\s+\d+/i,
  /^\s*best\s+\d+/i,
  /^\s*\d+\s+(?:best|top|biggest|hottest|upcoming)/i,
  /^\s*(?:the\s+)?ultimate\s+guide/i,
  /^\s*(?:the\s+)?complete\s+guide/i,
  /\broundup\b/i,
  /\bevents?\s+this\s+(?:week|month|year)\b/i,
  /\bthings\s+to\s+do\b/i,
];

const EVENT_STRUCTURE_SIGNALS = [
  "register", "rsvp", "ticket", "attend", "join us",
  "save your spot", "reserve", "sign up", "get tickets",
  "free entry", "limited seats", "book now",
];

function isAllowedDomain(url: string): "allowed" | "blocked" | "unknown" {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    for (const d of BLOCKED_DOMAINS) {
      if (hostname.includes(d)) return "blocked";
    }
    for (const d of ALLOWED_EVENT_DOMAINS) {
      if (hostname.includes(d)) return "allowed";
    }
    return "unknown";
  } catch {
    return "unknown";
  }
}

// Strong title-only listicle indicators (high precision)
const STRONG_LISTICLE_TITLE_RE = /\b(top\s+\d+|best\s+\d+|\d+\s+(?:best|top|biggest|hottest|upcoming)|list\s+of|roundup|round-up|things\s+to\s+do|events?\s+this\s+(?:week|month|year))\b/i;

function hasSingleEventIdentifier(text: string): boolean {
  // Single-event identifier: explicit registration verb + a date-ish token nearby
  const hasReg = /\b(register|rsvp|get\s+tickets?|reserve|sign\s+up|book\s+now)\b/i.test(text);
  const hasDateish = /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(text);
  return hasReg && hasDateish;
}

function isListArticle(title: string, text: string): boolean {
  // 1) Strong title-pattern reject (high precision, low false-positive)
  if (STRONG_LISTICLE_TITLE_RE.test(title)) return true;
  for (const pat of LISTICLE_TITLE_PATTERNS) {
    if (pat.test(title)) return true;
  }
  const lowerTitle = title.toLowerCase();
  // 2) Title starts with classic listicle phrase
  for (const phrase of LIST_ARTICLE_PHRASES) {
    if (lowerTitle.startsWith(phrase)) return true;
  }
  // 3) Body check — only if no single-event identifier present, require ≥3 phrase hits (was 2 — too aggressive)
  if (hasSingleEventIdentifier(text)) return false;
  const lower = text.toLowerCase().substring(0, 1200);
  let matches = 0;
  for (const phrase of LIST_ARTICLE_PHRASES) {
    if (lower.includes(phrase)) matches++;
    if (matches >= 3) return true;
  }
  return false;
}

function hasEventStructure(text: string): { pass: boolean; signals: number; hasDate: boolean } {
  const lower = text.toLowerCase();
  let signals = 0;

  // Specific date: ISO, "12 Jan 2026", "Jan 12, 2026", etc. — NOT vague "this week"
  const hasDate = /\b\d{4}-\d{2}-\d{2}\b/.test(text) ||
    /\b\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}\b/i.test(text) ||
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\b/i.test(text);
  if (hasDate) signals++;

  // Specific time
  const hasTime = /\b\d{1,2}:\d{2}\s*(?:am|pm|AM|PM)?\b/.test(text) ||
    /\b\d{1,2}\s*(?:am|pm|AM|PM)\b/.test(text);
  if (hasTime) signals++;

  // Registration / RSVP language
  for (const sig of EVENT_STRUCTURE_SIGNALS) {
    if (lower.includes(sig)) { signals++; break; }
  }

  // Venue/location or explicit "online event"
  const hasLocation = /\b(?:venue|location|address|hall|center|centre|hotel|hub|space|online event|virtual event)\b/i.test(text);
  if (hasLocation) signals++;

  return { pass: signals >= 2, signals, hasDate };
}

/**
 * PAGE TYPE GATE (Stage 1 — Hard Filters, deterministic):
 * - Domain filter
 * - Listicle / blog detection (title + body)
 * - Event structure (≥2 signals)
 * - MUST have a real date signal
 */
/**
 * NORMALIZER (v7) — runs FIRST. Produces a uniform shape regardless of source.
 * Centralises date detection from BOTH metadata and text so downstream gates can trust it.
 */
interface NormalizedEvent {
  title: string;
  description: string;
  source_url: string | null;
  registration_link: string | null;
  source_platform: string;
  venue: string | null;
  city: string | null;
  event_date: string | null;        // YYYY-MM-DD
  event_time: string | null;
  end_date: string | null;
  organizer: string | null;
  is_online: boolean;
  has_metadata_date: boolean;       // true if date came from API/JSON-LD, not text
  source_type: "structured" | "discovery"; // routes through different gate rules
  has_time_signal: boolean;         // includes vague time words for discovery mode
  _submission_count?: number;
}

// Relative time words — only honored in DISCOVERY mode (X, Reddit, Discord)
const RELATIVE_TIME_WORDS = [
  "today", "tomorrow", "tonight",
  "this weekend", "this week", "this saturday", "this sunday",
  "this monday", "this tuesday", "this wednesday", "this thursday", "this friday",
  "next week", "next weekend",
  "next monday", "next tuesday", "next wednesday", "next thursday",
  "next friday", "next saturday", "next sunday",
];

function containsTimeWords(text: string): boolean {
  const lower = text.toLowerCase();
  for (const w of RELATIVE_TIME_WORDS) {
    if (lower.includes(w)) return true;
  }
  // also bare weekday near "join us" / "happening"
  if (/\b(?:happening|join\s+us|live|going\s+down)\b.{0,40}\b(?:mon|tue|wed|thu|fri|sat|sun)/i.test(text)) return true;
  return false;
}

// ============ DISCOVERY INTENT + SIGNAL SCORING (v9) ============
// Deterministic pre-AI guards for DISCOVERY mode only.

const EVENT_INTENT_PATTERNS: RegExp[] = [
  /\bjoin\s+us\b/i,
  /\bregister(?:ing|ed)?\b/i,
  /\brsvp\b/i,
  /\bdon[''']?t\s+miss\b/i,
  /\bwe[''']?re\s+host(?:ing)?\b/i,
  /\bwe\s+are\s+hosting\b/i,
  /\bwe[''']?re\s+organi[sz]ing\b/i,
  /\bhosting\s+(?:a|an|the)\b/i,
  /\b(?:twitter\s+)?spaces?\b/i,
  /\bx\s+space\b/i,
  /\bama\b/i,
  /\blive\s+session\b/i,
  /\bworkshop\b/i,
  /\bmeetup\b/i,
  /\bhackathon\b/i,
  /\bsave\s+the\s+date\b/i,
  /\bget\s+(?:your\s+)?tickets?\b/i,
  /\bsign\s+up\b/i,
  /\bstarts?\s+(?:in|at|on)\b/i,
  /\bhappening\s+(?:on|this|tomorrow|today|tonight)\b/i,
  // v10 — CTA / urgency
  /\bdm\s+(?:to|me|us)\b/i,
  /\blink\s+in\s+bio\b/i,
  /\bregister\s+here\b/i,
  /\bclick\s+(?:to|here)\s+(?:join|register|rsvp)\b/i,
  /\b(?:tonight|today|tomorrow)\b.{0,30}\b(?:web3|crypto|blockchain|defi|nft|spaces?|ama|meetup)\b/i,
  /\b(?:web3|crypto|blockchain|defi|nft|spaces?|ama|meetup)\b.{0,30}\b(?:tonight|today|tomorrow|this\s+(?:sat|sun|mon|tue|wed|thu|fri))/i,
];

function hasEventIntent(text: string): boolean {
  for (const p of EVENT_INTENT_PATTERNS) if (p.test(text)) return true;
  return false;
}

const PLATFORM_INDICATOR_RE = /\b(spaces?|x\s+space|twitter\s+space|meetup|workshop|ama|hackathon|conference|summit|webinar|bootcamp)\b/i;

function discoverySignalScore(ev: NormalizedEvent, fullText: string): {
  score: number;
  web3: boolean;
  time: boolean;
  intent: boolean;
  platform: boolean;
} {
  const web3 = web3KeywordScore(fullText) >= 1;
  const time = ev.has_time_signal;
  const intent = hasEventIntent(fullText);
  const platform = PLATFORM_INDICATOR_RE.test(fullText);
  const score = (web3 ? 1 : 0) + (time ? 1 : 0) + (intent ? 1 : 0) + (platform ? 1 : 0);
  return { score, web3, time, intent, platform };
}

// Past-event detection: only fires when a date is actually parsed.
function isPastDate(date: string | null): boolean {
  if (!date) return false;
  const d = new Date(date);
  if (isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d.getTime() < today.getTime();
}

// AI reason words that indicate uncertainty or past-event drift.
const AI_UNCERTAIN_RE = /\b(maybe|unclear|uncertain|might\s+be|possibly|recap|past\s+event|already\s+happened|retrospective|reflection|history|throwback)\b/i;

const STRUCTURED_PLATFORMS = new Set(["luma", "eventbrite", "meetup", "partiful", "community"]);
const DISCOVERY_PLATFORMS = new Set(["x", "x_discovery", "twitter", "reddit", "discord"]);

function classifySource(platform: string): "structured" | "discovery" {
  if (DISCOVERY_PLATFORMS.has(platform)) return "discovery";
  return "structured";
}

function normalizeEvent(raw: any): NormalizedEvent {
  const title = (raw.title || "").toString().trim();
  const description = (raw.description || "").toString();
  const fullText = `${title} ${description} ${raw.venue || ""} ${raw.city || ""}`;

  const metaDate = raw.event_date || raw.metadata?.event_date || null;
  const textDate = !metaDate ? extractDate(fullText) : null;
  const platform = (raw.source_platform || raw._source || "unknown").toString().toLowerCase();

  return {
    title,
    description,
    source_url: raw.source_url || null,
    registration_link: raw.registration_link || raw.source_url || null,
    source_platform: platform,
    venue: raw.venue || null,
    city: raw.city || null,
    event_date: metaDate || textDate,
    event_time: raw.event_time || null,
    end_date: raw.end_date || null,
    organizer: raw.organizer || null,
    is_online: !!raw.is_online || detectIsOnline(fullText),
    has_metadata_date: !!metaDate,
    source_type: classifySource(platform),
    has_time_signal: !!metaDate || !!textDate || containsTimeWords(fullText),
    _submission_count: raw._submission_count,
  };
}

/**
 * PAGE TYPE GATE v8 — SOURCE-AWARE.
 *
 * STRUCTURED MODE (Eventbrite, Luma, Meetup, community):
 *   - Domain check + listicle reject + ≥2 structure signals + real date (text/meta)
 *
 * DISCOVERY MODE (X, Reddit, Discord):
 *   - Title-level listicle reject only
 *   - Require ANY time signal (specific OR vague: "this Saturday")
 *   - Web3 relevance enforced in Stage 2; structural rules left to AI
 */
function pageTypeGate(ev: NormalizedEvent): { pass: boolean; reason: string } {
  const url = ev.source_url || "";
  const fullText = `${ev.title} ${ev.description}`;

  // Title-level listicle reject — applies to BOTH modes
  if (STRONG_LISTICLE_TITLE_RE.test(ev.title)) {
    return { pass: false, reason: "listicle title pattern" };
  }
  for (const pat of LISTICLE_TITLE_PATTERNS) {
    if (pat.test(ev.title)) return { pass: false, reason: "listicle title pattern" };
  }

  if (ev.source_type === "discovery") {
    if (ev.title.length < 10) return { pass: false, reason: "discovery: title too short" };
    if (!ev.has_time_signal) {
      return { pass: false, reason: "discovery: no time signal (specific or relative)" };
    }
    return { pass: true, reason: "ok (discovery)" };
  }

  // STRUCTURED
  const domainStatus = isAllowedDomain(url);
  if (domainStatus === "blocked") return { pass: false, reason: `blocked domain: ${url}` };

  if (isListArticle(ev.title, fullText)) {
    return { pass: false, reason: "listicle/blog content detected" };
  }

  const structure = hasEventStructure(fullText);
  if (domainStatus === "unknown" && !structure.pass) {
    return { pass: false, reason: `unknown domain, weak event structure (signals=${structure.signals})` };
  }

  const hasValidDate = structure.hasDate || ev.has_metadata_date || !!ev.event_date;
  if (domainStatus !== "allowed" && !hasValidDate) {
    return { pass: false, reason: "no specific date found (text or metadata)" };
  }

  return { pass: true, reason: "ok (structured)" };
}

// ============ AI CLASSIFICATION ============

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

interface AIClassification {
  is_event: boolean;
  is_listicle: boolean;
  event_type: string;
  has_real_date: boolean;
  has_location: boolean;
  has_registration: boolean;
  is_online: boolean;
  confidence: number;
  reason: string;
  event_date?: string | null;
  state?: string | null;
  city?: string | null;
  tags?: string[];
}

async function classifyWithAI(
  event: { title: string; description?: string; venue?: string; city?: string; source_url?: string },
  apiKey: string,
  sourceType: "structured" | "discovery" = "structured",
): Promise<AIClassification | null> {
  const modeRules = sourceType === "discovery"
    ? `MODE: DISCOVERY (social post / tweet)
Accept if it ANNOUNCES ONE specific upcoming Web3 event (meetup, hackathon, AMA, twitter space, workshop).
A vague time like "this Saturday", "tomorrow", "next week" is acceptable IF the event itself is concrete.
Reject if it is general commentary, a thread, news, or a promotional brand post with no specific event.
Extract event_date as YYYY-MM-DD if you can resolve the relative time vs today.`
    : `MODE: STRUCTURED (Eventbrite / Luma / Meetup / event page)
Accept ONLY if it describes ONE specific event with a clear specific date, a location (or explicitly online), and a registration method.
Reject blog posts, listicles ("Top 10..."), news articles, or generic pages.`;

  const userPrompt = `Analyze the following content and return STRICT JSON via the classify_event tool.

${modeRules}

Common rejects (BOTH MODES):
- Listicles / roundups / "best of" articles
- Blog posts, news articles
- Web3 / blockchain / crypto / DeFi / NFT / DAO must be the CORE topic — not a side mention

CONTENT:
Title: ${event.title}
URL: ${event.source_url || "N/A"}
Venue: ${event.venue || "N/A"}
City: ${event.city || "N/A"}
Description: ${(event.description || "").substring(0, 1500)}`;

  const tools = [{
    type: "function",
    function: {
      name: "classify_event",
      description: "Classify whether the content is a single, specific Web3 event.",
      parameters: {
        type: "object",
        properties: {
          is_event: { type: "boolean", description: "True only if this is ONE specific event (not a list, blog, or article)" },
          is_listicle: { type: "boolean", description: "True if this is a list of multiple events, blog post, or article" },
          event_type: { type: "string", enum: ["meetup", "hackathon", "workshop", "conference", "ama", "online_session", "bootcamp", "summit", "webinar", "other"] },
          has_real_date: { type: "boolean", description: "True only if a SPECIFIC calendar date is present (not vague)" },
          has_location: { type: "boolean", description: "True if a physical venue/city is present" },
          has_registration: { type: "boolean", description: "True if registration/RSVP/ticket link or method exists" },
          is_online: { type: "boolean", description: "True if the event is explicitly online/virtual" },
          confidence: { type: "number", description: "0.0-1.0 confidence this is a real, specific Web3 event" },
          reason: { type: "string", description: "Short explanation (max 120 chars)" },
          event_date: { type: ["string", "null"], description: "YYYY-MM-DD if extractable, else null" },
          state: { type: ["string", "null"], description: "Nigerian state name or 'Online'" },
          city: { type: ["string", "null"] },
          tags: { type: "array", items: { type: "string" } },
        },
        required: ["is_event", "is_listicle", "event_type", "has_real_date", "has_location", "has_registration", "is_online", "confidence", "reason"],
      },
    },
  }];

  const body = JSON.stringify({
    model: "google/gemini-2.5-flash",
    messages: [
      { role: "system", content: "You are an event classification engine. Be strict. Reject anything that is not a single, specific Web3 event. Bias toward rejection when in doubt." },
      { role: "user", content: userPrompt },
    ],
    tools,
    tool_choice: { type: "function", function: { name: "classify_event" } },
    temperature: 0.0,
  });

  // Retry up to 2 times on 429/5xx with exponential backoff
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const resp = await fetch(AI_GATEWAY_URL, {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body,
      });

      if (resp.status === 429 || (resp.status >= 500 && resp.status < 600)) {
        const wait = 1000 * Math.pow(2, attempt);
        console.warn(`[AI] ${resp.status} on attempt ${attempt + 1}, retrying in ${wait}ms`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }

      if (!resp.ok) {
        console.error(`[AI] Classification failed: ${resp.status} ${await resp.text().catch(() => "")}`);
        return null;
      }

      const data = await resp.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall?.function?.arguments) {
        console.error('[AI] No tool call in response');
        return null;
      }
      return JSON.parse(toolCall.function.arguments) as AIClassification;
    } catch (e) {
      console.error(`[AI] Attempt ${attempt + 1} error:`, e);
      if (attempt === 2) return null;
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }
  return null;
}

// ============ UTILITY FUNCTIONS ============

function detectState(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("online") || lower.includes("virtual") || lower.includes("remote")) return "Online";
  for (const [state, cities] of Object.entries(STATE_CITIES)) {
    for (const city of cities) {
      if (lower.includes(city)) return state;
    }
  }
  for (const state of NIGERIAN_STATES) {
    if (lower.includes(state.toLowerCase())) return state;
  }
  return "Unknown";
}

function detectEventType(text: string): string {
  const lower = text.toLowerCase();
  for (const [type, keywords] of Object.entries(EVENT_TYPE_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) return type;
    }
  }
  return "other";
}

function detectIsOnline(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes("online") || lower.includes("virtual") || lower.includes("remote") || lower.includes("webinar") || lower.includes("twitter space") || lower.includes("x space");
}

function extractDate(text: string): string | null {
  const patterns = [
    /(\d{4}-\d{2}-\d{2})/,
    /(\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/i,
    /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/i,
  ];
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) {
      try {
        const d = new Date(m[0]);
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
      } catch { /* continue */ }
    }
  }
  return null;
}

function computeConfidence(event: any): number {
  let score = 0.2;
  if (event.title) score += 0.15;
  if (event.event_date) score += 0.2;
  if (event.state && event.state !== "Unknown") score += 0.15;
  if (event.registration_link) score += 0.15;
  if (event.description && event.description.length > 30) score += 0.1;
  if (event.venue) score += 0.05;
  return Math.min(score, 1.0);
}

// ============ IMPROVED DEDUP ============

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\b(?:tickets?|register\s*now|rsvp|free\s+entry|book\s+now|sign\s*up)\b/gi, '')
    .replace(/[-_|·•]/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/$/, '');
    return `${u.hostname.toLowerCase()}${path}`;
  } catch {
    return url.toLowerCase().split('?')[0].replace(/\/$/, '');
  }
}

function titleSimilarity(a: string, b: string): number {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (na === nb) return 1.0;
  const tokensA = new Set(na.split(' ').filter(t => t.length > 2));
  const tokensB = new Set(nb.split(' ').filter(t => t.length > 2));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let overlap = 0;
  for (const t of tokensA) { if (tokensB.has(t)) overlap++; }
  return (2 * overlap) / (tokensA.size + tokensB.size);
}

async function generateDedupHash(title: string, date: string | null, state: string): Promise<string> {
  const raw = `${normalizeTitle(title)}|${date || ''}|${state}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
}

async function isDuplicateEvent(
  title: string, date: string | null, link: string | null, sourceUrl: string | null,
  dedupHash: string, supabase: any
): Promise<boolean> {
  // 1) Exact hash
  const { data: exactMatch } = await supabase
    .from('events')
    .select('id')
    .eq('dedup_hash', dedupHash)
    .maybeSingle();
  if (exactMatch) return true;

  // 2) Same normalized link (registration_link OR source_url)
  const candidates = Array.from(new Set([normalizeUrl(link), normalizeUrl(sourceUrl)].filter(Boolean) as string[]));
  for (const norm of candidates) {
    const { data: linkMatches } = await supabase
      .from('events')
      .select('id, registration_link, source_url')
      .or(`registration_link.ilike.%${norm}%,source_url.ilike.%${norm}%`)
      .limit(10);
    if (linkMatches) {
      for (const m of linkMatches) {
        if (normalizeUrl(m.registration_link) === norm || normalizeUrl(m.source_url) === norm) return true;
      }
    }
  }

  // 3) Fuzzy title match on same date
  if (date) {
    const { data: sameDateEvents } = await supabase
      .from('events')
      .select('id, title')
      .eq('event_date', date)
      .limit(50);
    if (sameDateEvents) {
      for (const ev of sameDateEvents) {
        if (titleSimilarity(title, ev.title) > 0.7) return true;
      }
    }
  } else {
    // 4) Cross-platform fallback (no date) — strict similarity threshold
    const { data: noDateCandidates } = await supabase
      .from('events')
      .select('id, title')
      .limit(200);
    if (noDateCandidates) {
      for (const ev of noDateCandidates) {
        if (titleSimilarity(title, ev.title) > 0.85) return true;
      }
    }
  }

  return false;
}

// ============ FIRECRAWL (enrichment only) ============

const FIRECRAWL_API_URL = "https://api.firecrawl.dev/v1";

// Parse JSON-LD Event blocks out of raw HTML — works for lu.ma, eventbrite, meetup, etc.
function extractJsonLdEvent(rawHtml: string): {
  event_date: string | null;
  event_time: string | null;
  end_date: string | null;
  venue: string | null;
  city: string | null;
  organizer: string | null;
  is_online: boolean;
  title: string | null;
  description: string | null;
} {
  const empty = {
    event_date: null, event_time: null, end_date: null,
    venue: null, city: null, organizer: null, is_online: false,
    title: null, description: null,
  };
  if (!rawHtml) return empty;
  try {
    const matches = rawHtml.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    for (const m of matches) {
      try {
        const ld = JSON.parse(m[1].trim());
        const items = Array.isArray(ld) ? ld : (ld['@graph'] || [ld]);
        for (const item of items) {
          const t = item['@type'];
          const isEvent = t === 'Event' || (Array.isArray(t) && t.includes('Event')) ||
            (typeof t === 'string' && /Event$/.test(t));
          if (!isEvent) continue;
          const start = item.startDate ? new Date(item.startDate) : null;
          const end = item.endDate ? new Date(item.endDate) : null;
          const isOnline = item.eventAttendanceMode?.toString().includes('Online') ||
            item.location?.['@type'] === 'VirtualLocation';
          return {
            event_date: start && !isNaN(start.getTime()) ? start.toISOString().split('T')[0] : null,
            event_time: start && !isNaN(start.getTime()) ? start.toISOString().split('T')[1].substring(0, 8) : null,
            end_date: end && !isNaN(end.getTime()) ? end.toISOString().split('T')[0] : null,
            venue: item.location?.name || null,
            city: item.location?.address?.addressLocality || item.location?.address?.addressRegion || null,
            organizer: item.organizer?.name || (typeof item.organizer === 'string' ? item.organizer : null),
            is_online: !!isOnline,
            title: item.name || null,
            description: item.description || null,
          };
        }
      } catch { /* next block */ }
    }
  } catch { /* fall through */ }
  return empty;
}

async function enrichLink(link: string, firecrawlApiKey: string): Promise<any | null> {
  try {
    console.log(`[Enrich] Scraping: ${link}`);
    const resp = await fetch(`${FIRECRAWL_API_URL}/scrape`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${firecrawlApiKey}`,
        "Content-Type": "application/json",
      },
      // rawHtml gives us JSON-LD; markdown is human readable backup
      body: JSON.stringify({ url: link, formats: ["markdown", "rawHtml"] }),
    });

    if (!resp.ok) {
      console.error(`[Enrich] Failed: ${resp.status}`);
      return null;
    }

    const data = await resp.json();
    const result = data.data || data;
    const markdown = result.markdown || "";
    const rawHtml = result.rawHtml || result.html || "";
    const meta = result.metadata || {};

    const ld = extractJsonLdEvent(rawHtml);

    const title = ld.title || meta.title || meta.ogTitle || "";
    const description = ld.description || meta.description || meta.ogDescription || markdown.substring(0, 1500);

    if (!title || title.length < 5) return null;

    console.log(`[Enrich OK] "${title.substring(0, 60)}" date=${ld.event_date} venue=${ld.venue} online=${ld.is_online}`);

    return {
      title,
      description,
      source_url: link,
      registration_link: link,
      source_platform: "community",
      venue: ld.venue,
      city: ld.city,
      event_date: ld.event_date,
      event_time: ld.event_time,
      end_date: ld.end_date,
      organizer: ld.organizer,
      is_online: ld.is_online,
      _raw_markdown: markdown,
      // Mark date as metadata-derived so the gate trusts it
      metadata: { event_date: ld.event_date },
    };
  } catch (e) {
    console.error('[Enrich] Error:', e);
    return null;
  }
}

// ============ X/TWITTER DISCOVERY via Firecrawl search ============
// Returns BOTH:
//   - outboundLinks: lu.ma/eventbrite/meetup links found inside tweets (enrich → structured)
//   - tweetEvents:    raw X-native events (the tweet IS the event) → discovery mode
async function discoverFromXTwitter(firecrawlApiKey: string): Promise<{
  outboundLinks: string[];
  tweetEvents: any[];
}> {
  const outboundLinks: string[] = [];
  const tweetEvents: any[] = [];
  const queries = [
    'site:x.com "web3 event" Lagos',
    'site:x.com "blockchain meetup" Nigeria',
    'site:x.com "crypto meetup" Nigeria',
    'site:x.com "web3 hackathon" Nigeria',
    'site:x.com "twitter space" web3 Nigeria',
    'site:x.com web3 workshop Lagos',
    // Behavioral / natural-language queries (v10)
    'site:x.com "hosting a web3" Nigeria',
    'site:x.com "join us" web3 Lagos',
    'site:x.com "RSVP" crypto Nigeria',
    'site:x.com "AMA" blockchain Africa',
    'site:x.com "spaces tonight" web3',
    'site:x.com "this saturday" crypto Lagos',
    'site:x.com "register" web3 Africa',
  ];

  for (const query of queries) {
    try {
      console.log(`[X Discovery] Searching: "${query}"`);
      const resp = await fetch(`${FIRECRAWL_API_URL}/search`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${firecrawlApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          limit: 6,
          scrapeOptions: { formats: ["markdown"] },
        }),
      });

      if (!resp.ok) {
        console.error(`[X Discovery] Failed for "${query}": ${resp.status}`);
        continue;
      }

      const data = await resp.json();
      const results = data.data || [];

      for (const r of results) {
        const tweetUrl: string = r.url || r.metadata?.sourceURL || "";
        const md: string = r.markdown || r.content || "";
        const desc: string = r.description || r.metadata?.description || "";
        const title: string = r.title || r.metadata?.title || "";
        const text = `${title}\n${desc}\n${md}`.trim();

        if (!tweetUrl.includes("x.com") && !tweetUrl.includes("twitter.com")) continue;

        // 1) Extract outbound event links
        const urlMatches = text.matchAll(/https?:\/\/(?:lu\.ma|www\.eventbrite\.com|eventbrite\.com|meetup\.com|partiful\.com)[^\s")<\]]+/g);
        for (const m of urlMatches) outboundLinks.push(m[0]);

        // 2) Build a tweet-native event candidate
        // Use first non-empty meaningful line as title; full text as description
        const cleanedTitle = (title || desc.split("\n")[0] || md.split("\n").find(l => l.trim().length > 20) || "").trim().substring(0, 240);
        if (cleanedTitle.length < 10) continue;

        tweetEvents.push({
          title: cleanedTitle,
          description: text.substring(0, 1500),
          source_url: tweetUrl,
          registration_link: tweetUrl,
          source_platform: "x",
          venue: null,
          city: null,
          event_date: null,
          event_time: null,
          end_date: null,
          organizer: null,
          is_online: /twitter\s+space|x\s+space|virtual|online|zoom|gmeet|google\s+meet/i.test(text),
        });
      }

      await new Promise(r => setTimeout(r, 500));
    } catch (e) {
      console.error(`[X Discovery] Error:`, e);
    }
  }

  return {
    outboundLinks: [...new Set(outboundLinks)],
    tweetEvents,
  };
}

// ============ PLATFORM SCRAPERS ============

// Luma's public REST search API (api.lu.ma/public/v2/event/search) returns 404 — deprecated.
// New strategy: use Firecrawl `/search` to find real lu.ma event pages, then enrich each one.
// Firecrawl pulls JSON-LD + metadata, which is far more reliable than HTML scraping.
async function scrapeLumaEvents(firecrawlApiKey: string): Promise<any[]> {
  const events: any[] = [];
  if (!firecrawlApiKey) {
    console.warn('[Luma] No Firecrawl key — skipping Luma discovery');
    return events;
  }

  const queries = [
    'site:lu.ma web3 nigeria',
    'site:lu.ma blockchain lagos',
    'site:lu.ma crypto africa',
    'site:lu.ma defi nigeria',
  ];

  const seen = new Set<string>();
  for (const query of queries) {
    try {
      console.log(`[Luma] Firecrawl search: "${query}"`);
      const resp = await fetch(`${FIRECRAWL_API_URL}/search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${firecrawlApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, limit: 5 }),
      });
      if (!resp.ok) {
        console.warn(`[Luma] Search failed for "${query}" (${resp.status})`);
        continue;
      }
      const data = await resp.json();
      const results = data.data || [];
      for (const r of results) {
        const url: string = r.url || r.metadata?.sourceURL || '';
        // Only individual event pages, not profile/group pages
        if (!/^https?:\/\/lu\.ma\/[a-z0-9-]{4,}$/i.test(url)) continue;
        if (seen.has(url)) continue;
        seen.add(url);
        const title: string = r.title || r.metadata?.title || '';
        const description: string = r.description || r.metadata?.description || '';
        if (!title || title.length < 5) continue;
        events.push({
          title,
          description,
          event_date: null, // will be resolved by enrichLink + AI
          event_time: null,
          end_date: null,
          venue: null,
          city: null,
          registration_link: url,
          source_url: url,
          source_platform: 'luma',
          is_online: false,
          organizer: null,
        });
      }
      await new Promise(r => setTimeout(r, 400));
    } catch (e) {
      console.error(`[Luma] Error for "${query}":`, e);
    }
  }
  console.log(`[Luma] Discovered ${events.length} candidate event pages`);
  return events;
}

async function scrapeEventbriteEvents(): Promise<any[]> {
  const events: any[] = [];
  const queries = ["web3", "blockchain", "crypto", "defi", "nft", "web3-africa", "blockchain-lagos"];

  for (const query of queries) {
    try {
      const url = `https://www.eventbrite.com/d/nigeria/${query}/`;
      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
        }
      });

      if (!resp.ok) continue;

      const html = await resp.text();
      const jsonLdMatches = html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
      for (const m of jsonLdMatches) {
        try {
          const ld = JSON.parse(m[1]);
          const items = Array.isArray(ld) ? ld : [ld];
          for (const item of items) {
            if (item['@type'] === 'Event') {
              events.push({
                title: item.name || "",
                description: (item.description || "").substring(0, 500),
                event_date: item.startDate ? new Date(item.startDate).toISOString().split('T')[0] : null,
                event_time: item.startDate ? new Date(item.startDate).toTimeString().split(' ')[0] : null,
                end_date: item.endDate ? new Date(item.endDate).toISOString().split('T')[0] : null,
                venue: item.location?.name || null,
                city: item.location?.address?.addressLocality || null,
                registration_link: item.url || null,
                source_url: item.url || null,
                source_platform: "eventbrite",
                is_online: item.location?.['@type'] === 'VirtualLocation',
                organizer: item.organizer?.name || null,
              });
            }
          }
        } catch { /* skip */ }
      }
    } catch (e) {
      console.error(`[Eventbrite] Error for "${query}":`, e);
    }
  }
  return events;
}

async function scrapeMeetupEvents(): Promise<any[]> {
  const events: any[] = [];
  const urls = [
    'https://www.meetup.com/find/?keywords=web3+blockchain+crypto&location=ng--Lagos',
    'https://www.meetup.com/find/?keywords=web3&location=ng--Abuja',
    'https://www.meetup.com/find/?keywords=blockchain+crypto&location=ng--Lagos',
  ];

  for (const url of urls) {
    try {
      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html',
        }
      });

      if (!resp.ok) continue;

      const html = await resp.text();
      const jsonLdMatches = html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
      for (const m of jsonLdMatches) {
        try {
          const ld = JSON.parse(m[1]);
          const items = Array.isArray(ld) ? ld : [ld];
          for (const item of items) {
            if (item['@type'] === 'Event') {
              events.push({
                title: item.name || "",
                description: (item.description || "").substring(0, 500),
                event_date: item.startDate ? new Date(item.startDate).toISOString().split('T')[0] : null,
                event_time: item.startDate ? new Date(item.startDate).toTimeString().split(' ')[0] : null,
                venue: item.location?.name || null,
                city: item.location?.address?.addressLocality || null,
                registration_link: item.url || null,
                source_url: item.url || null,
                source_platform: "meetup",
                is_online: item.location?.['@type'] === 'VirtualLocation',
                organizer: item.organizer?.name || null,
              });
            }
          }
        } catch { /* skip */ }
      }
    } catch (e) {
      console.error('[Meetup] Error:', e);
    }
  }
  return events;
}

// ============ HYBRID FILTER PIPELINE (v7) ============

/**
 * FINAL VALIDATOR — single source of truth.
 * Combines AI classification (signals only) + normalized event facts.
 * AI is now classification-only; structural rules live HERE.
 */
function finalValidate(ev: NormalizedEvent, ai: AIClassification): { ok: boolean; reason: string } {
  if (!ai.is_event) return { ok: false, reason: `AI: not an event (${ai.reason})` };
  if (ai.is_listicle) return { ok: false, reason: `AI: listicle (${ai.reason})` };

  // AI reason anti-drift guard — reject hedged or past-event language.
  if (ai.reason && AI_UNCERTAIN_RE.test(ai.reason)) {
    return { ok: false, reason: `AI: hedged/past-event language ("${ai.reason}")` };
  }

  const eventDate = ai.event_date || ev.event_date;

  // Future-event validation — only when a real date was resolvable.
  if (isPastDate(eventDate)) {
    return { ok: false, reason: `past event (date=${eventDate})` };
  }

  if (ev.source_type === "discovery") {
    if (ai.confidence < 0.85) return { ok: false, reason: `AI discovery: low confidence ${ai.confidence}` };
    return { ok: true, reason: "ok (discovery)" };
  }

  // STRUCTURED — strict
  if (ai.confidence < 0.85) return { ok: false, reason: `AI: low confidence ${ai.confidence}` };
  if (!eventDate) return { ok: false, reason: "no resolvable date (text+metadata+AI all empty)" };

  const isOnline = ai.is_online || ev.is_online;
  const hasLocation = !!ev.venue || !!ev.city || !!ai.city || !!ai.state || isOnline;
  if (!hasLocation) return { ok: false, reason: "no location (no venue/city/online)" };

  const hasRegistration = !!ev.registration_link || !!ev.source_url || ai.has_registration;
  if (!hasRegistration) return { ok: false, reason: "no registration link" };

  return { ok: true, reason: "ok (structured)" };
}

async function processEvent(
  raw: any,
  sourceName: string,
  supabase: any,
  lovableApiKey: string,
  stats: any
): Promise<boolean> {
  // STAGE 0: NORMALIZE — uniform shape, metadata-aware date extraction
  const ev = normalizeEvent(raw);
  if (!ev.title || ev.title.length < 5) return false;

  const fullText = `${ev.title} ${ev.description} ${ev.venue || ''} ${ev.city || ''}`;

  // STAGE 1: Page Type Gate (now metadata-aware)
  const gate = pageTypeGate(ev);
  if (!gate.pass) {
    stats.filtered_gate++;
    console.log(`[GATE REJECT] "${ev.title}" — ${gate.reason}`);
    return false;
  }

  // STAGE 2: Web3 keyword pre-filter (source-aware threshold)
  const kwScore = web3KeywordScore(fullText);
  const kwThreshold = ev.source_type === "discovery" ? 1 : 2;
  if (kwScore < kwThreshold) {
    stats.filtered_keyword++;
    console.log(`[KEYWORD REJECT] "${ev.title}" (score=${kwScore}, need=${kwThreshold}, mode=${ev.source_type})`);
    return false;
  }

  // STAGE 2b (DISCOVERY ONLY): Intent + signal-score gate — kills tweets with no
  // event intent (recaps, news, brand chatter) BEFORE we spend AI tokens on them.
  if (ev.source_type === "discovery") {
    const sig = discoverySignalScore(ev, fullText);
    if (!sig.intent) {
      stats.filtered_keyword++;
      console.log(`[DISCOVERY REJECT] "${ev.title}" — no intent signal (score=${sig.score}, web3=${sig.web3} time=${sig.time} platform=${sig.platform})`);
      return false;
    }
    if (sig.score < 2) {
      stats.filtered_keyword++;
      console.log(`[DISCOVERY REJECT] "${ev.title}" — low score=${sig.score} (need ≥2)`);
      return false;
    }
    // Past-date short-circuit — ONLY trust metadata dates here. Text-extracted dates
    // in tweets are noisy (random YYYY-MM-DD substrings, embedded timestamps).
    // The AI will resolve the real date later; finalValidate will reject if past.
    if (ev.has_metadata_date && isPastDate(ev.event_date)) {
      stats.filtered_gate++;
      console.log(`[DISCOVERY REJECT] "${ev.title}" — past metadata date ${ev.event_date}`);
      return false;
    }
    console.log(`[DISCOVERY PASS] "${ev.title.substring(0, 60)}" score=${sig.score} intent=${sig.intent} time=${sig.time} platform=${sig.platform}`);
  } else {
    // Structured: short-circuit on past metadata dates only.
    // (Text-extracted dates from enriched markdown are unreliable; let AI resolve.)
    if (ev.has_metadata_date && isPastDate(ev.event_date)) {
      stats.filtered_gate++;
      console.log(`[GATE REJECT] "${ev.title}" — past metadata date ${ev.event_date}`);
      return false;
    }
  }

  // STAGE 3: AI classification (CLASSIFICATION ONLY — no enforcement here)
  if (!lovableApiKey) {
    stats.filtered_ai++;
    console.log(`[AI SKIP-REJECT] "${ev.title}" — no AI key`);
    return false;
  }

  const aiResult = await classifyWithAI(
    { title: ev.title, description: ev.description, venue: ev.venue || undefined, city: ev.city || undefined, source_url: ev.source_url || undefined },
    lovableApiKey,
    ev.source_type,
  );

  if (!aiResult) {
    stats.filtered_ai++;
    console.log(`[AI REJECT] "${ev.title}" — classifier failed`);
    return false;
  }

  // STAGE 4: FINAL VALIDATOR (single source of truth)
  const verdict = finalValidate(ev, aiResult);
  if (!verdict.ok) {
    stats.filtered_ai++;
    const tag = ev.source_type === "discovery" ? "AI REJECT DISCOVERY" : "FINAL REJECT";
    console.log(`[${tag}] "${ev.title}" — ${verdict.reason} | AI conf=${aiResult.confidence}`);
    return false;
  }
  const acceptTag = ev.source_type === "discovery" ? "AI ACCEPT DISCOVERY" : "ACCEPT";
  console.log(`[${acceptTag}] "${ev.title}" confidence=${aiResult.confidence} reason="${aiResult.reason}"`);

  // Build final record
  const eventDate = aiResult.event_date || ev.event_date;
  const isOnline = aiResult.is_online || ev.is_online;
  const detectedState = aiResult.state || detectState(fullText);
  const resolvedState = !detectedState || detectedState === "Unknown" ? (isOnline ? "Online" : "Lagos") : detectedState;
  const eventType = aiResult.event_type || detectEventType(fullText);
  const city = aiResult.city || ev.city || null;
  const tags = aiResult.tags || [];
  const confidenceScore = aiResult.confidence;
  const dedupHash = await generateDedupHash(ev.title, eventDate, resolvedState);

  // STAGE 5: Dedup
  const isDupe = await isDuplicateEvent(ev.title, eventDate, ev.registration_link, ev.source_url, dedupHash, supabase);
  if (isDupe) {
    stats.duplicates++;
    return false;
  }

  const submissionCount = ev._submission_count || 0;
  const popularityScore = (submissionCount * 0.4) + (confidenceScore * 0.6);

  const { error } = await supabase.from('events').insert({
    title: ev.title.substring(0, 500),
    description: ev.description?.substring(0, 2000) || null,
    city,
    state: resolvedState,
    country: "Nigeria",
    venue: ev.venue,
    event_date: eventDate,
    event_time: ev.event_time,
    end_date: ev.end_date,
    organizer: ev.organizer,
    registration_link: ev.registration_link,
    source_url: ev.source_url,
    event_type: eventType,
    tags,
    is_online: isOnline,
    confidence_score: confidenceScore,
    dedup_hash: dedupHash,
    status: 'upcoming',
    source_platform: ev.source_platform || sourceName,
    image_url: null,
    submission_count: submissionCount,
    popularity_score: popularityScore,
    posted_to_telegram: false,
  });

  if (error) {
    console.error('Insert error:', error.message);
    stats.errors += `Insert: ${error.message}; `;
    return false;
  }

  stats.inserted++;
  console.log(`INSERTED: "${ev.title}" [${eventType}] confidence=${confidenceScore}`);
  return true;
}

// ============ MAIN HANDLER ============

Deno.serve(async () => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    const emptyStats = () => ({ found: 0, inserted: 0, duplicates: 0, filtered_keyword: 0, filtered_ai: 0, filtered_gate: 0, errors: '' });
    const results: Record<string, any> = {
      luma: emptyStats(),
      eventbrite: emptyStats(),
      meetup: emptyStats(),
      x: emptyStats(),                // tweet-native (discovery mode)
      x_discovery: emptyStats(),      // outbound links enriched (structured mode)
    };

    // ---- Phase 1: Scrape structured platforms in parallel ----
    const [lumaEvents, eventbriteEvents, meetupEvents] = await Promise.all([
      scrapeLumaEvents(firecrawlApiKey).catch(e => { results.luma.errors = String(e); return []; }),
      scrapeEventbriteEvents().catch(e => { results.eventbrite.errors = String(e); return []; }),
      scrapeMeetupEvents().catch(e => { results.meetup.errors = String(e); return []; }),
    ]);

    results.luma.found = lumaEvents.length;
    results.eventbrite.found = eventbriteEvents.length;
    results.meetup.found = meetupEvents.length;

    // Enrich Luma candidates with full page content (date/venue live in JSON-LD/metadata)
    const enrichedLuma: any[] = [];
    if (firecrawlApiKey && lumaEvents.length > 0) {
      for (const lev of lumaEvents.slice(0, 8)) {
        const enriched = await enrichLink(lev.source_url, firecrawlApiKey);
        if (enriched) {
          enriched.source_platform = "luma";
          enriched.title = enriched.title || lev.title;
          enrichedLuma.push(enriched);
        } else {
          // Keep the lightweight candidate so the AI still gets a shot
          enrichedLuma.push(lev);
        }
      }
    }

    // ---- Phase 1b: X/Twitter discovery (DUAL OUTPUT) ----
    let xDiscoveredEvents: any[] = []; // enriched outbound (structured)
    let xTweetEvents: any[] = [];      // tweet-native (discovery)
    if (firecrawlApiKey) {
      try {
        const { outboundLinks, tweetEvents } = await discoverFromXTwitter(firecrawlApiKey);
        console.log(`[X Discovery] outbound=${outboundLinks.length} tweetEvents=${tweetEvents.length}`);
        results.x_discovery.found = outboundLinks.length;
        results.x.found = tweetEvents.length;
        xTweetEvents = tweetEvents;

        for (const link of outboundLinks.slice(0, 8)) {
          const enriched = await enrichLink(link, firecrawlApiKey);
          if (enriched) {
            enriched.source_platform = "x_discovery";
            xDiscoveredEvents.push(enriched);
          }
        }
      } catch (e) {
        results.x_discovery.errors = String(e);
      }
    }

    // ---- Phase 2: Process all events through pipeline ----
    const allRaw = [
      ...enrichedLuma.map(e => ({ ...e, _source: 'luma' as const })),
      ...eventbriteEvents.map(e => ({ ...e, _source: 'eventbrite' as const })),
      ...meetupEvents.map(e => ({ ...e, _source: 'meetup' as const })),
      ...xDiscoveredEvents.map(e => ({ ...e, _source: 'x_discovery' as const })),
      ...xTweetEvents.map(e => ({ ...e, _source: 'x' as const })),
    ];

    console.log(`Total raw candidates: ${allRaw.length} (max 50 will be processed)`);

    // Source breakdown logging
    const sourceBreakdown: Record<string, number> = {};
    for (const r of allRaw) sourceBreakdown[r._source] = (sourceBreakdown[r._source] || 0) + 1;
    console.log(`[BREAKDOWN raw] ${JSON.stringify(sourceBreakdown)}`);

    let processed = 0;
    for (const raw of allRaw) {
      if (processed >= 50) break; // Cap per run
      try {
        await processEvent(raw, raw._source, supabase, lovableApiKey, results[raw._source]);
        processed++;
      } catch (e) {
        console.error('Process event error:', e);
        results[raw._source].errors += String(e) + '; ';
      }
    }

    // Log scrape results
    for (const [source, stats] of Object.entries(results)) {
      await supabase.from('scrape_logs').insert({
        source,
        events_found: stats.found,
        events_inserted: stats.inserted,
        duplicates_skipped: stats.duplicates,
        errors: stats.errors || null,
      });
    }

    // Mark past events as completed
    await supabase
      .from('events')
      .update({ status: 'completed' })
      .lt('event_date', new Date().toISOString().split('T')[0])
      .eq('status', 'upcoming');

    // ---- Process user submissions with enrichment ----
    const { data: submissions } = await supabase
      .from('user_submitted_events')
      .select('*')
      .eq('processed', false)
      .limit(10);

    let submissionsProcessed = 0, submissionsAccepted = 0;
    if (submissions && submissions.length > 0 && firecrawlApiKey) {
      for (const sub of submissions) {
        let enrichedEvent: any = null;
        if (sub.link) {
          enrichedEvent = await enrichLink(sub.link, firecrawlApiKey);
        }

        if (enrichedEvent) {
          enrichedEvent._submission_count = sub.submission_count;
          const subStats = emptyStats();
          const accepted = await processEvent(enrichedEvent, 'community', supabase, lovableApiKey, subStats);
          if (accepted) submissionsAccepted++;
        }

        await supabase.from('user_submitted_events')
          .update({ processed: true })
          .eq('id', sub.id);
        submissionsProcessed++;
      }
    }

    // FAILSAFE
    const totalInserted = Object.values(results).reduce((s: number, r: any) => s + r.inserted, 0);
    const totalFound = Object.values(results).reduce((s: number, r: any) => s + r.found, 0);

    if (totalInserted === 0 && totalFound === 0) {
      console.log('FAILSAFE: No events found anywhere.');
    }

    console.log(`Pipeline complete. Found=${totalFound}, Inserted=${totalInserted}`);

    return new Response(JSON.stringify({
      ok: true,
      scrape_results: results,
      submissions: { processed: submissionsProcessed, accepted: submissionsAccepted },
      total_found: totalFound,
      total_inserted: totalInserted,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('Pipeline error:', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
