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
  "top ", "best ", "list of", "in this article", "here are",
  "upcoming events in", "about us", "our team", "privacy policy",
  "terms of service", "cookie policy", "subscribe to", "sign up for our",
  "read more", "related articles", "you might also like",
  "table of contents", "written by", "published on",
  "share this", "comments section",
  "things to do", "events this week", "we've compiled", "we have compiled",
  "roundup", "round-up", "ultimate guide", "complete guide",
  "discover the", "explore the", "check out these", "check out the",
  "top 5", "top 10", "top 20", "best of", "must attend", "must-attend",
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

function isListArticle(text: string): boolean {
  const lower = text.toLowerCase().substring(0, 500);
  let matches = 0;
  for (const phrase of LIST_ARTICLE_PHRASES) {
    if (lower.includes(phrase)) matches++;
  }
  return matches >= 2;
}

function hasEventStructure(text: string): { pass: boolean; signals: number } {
  const lower = text.toLowerCase();
  let signals = 0;

  // Check for date patterns
  const hasDate = /\d{4}-\d{2}-\d{2}/.test(text) ||
    /\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(text) ||
    /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}/i.test(text) ||
    /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i.test(text);
  if (hasDate) signals++;

  // Check for time
  const hasTime = /\d{1,2}:\d{2}\s*(?:am|pm|AM|PM)?/.test(text) ||
    /\d{1,2}\s*(?:am|pm|AM|PM)/.test(text);
  if (hasTime) signals++;

  // Check for registration/RSVP language
  for (const sig of EVENT_STRUCTURE_SIGNALS) {
    if (lower.includes(sig)) { signals++; break; }
  }

  // Check for venue/location
  const hasVenue = /venue|location|address|hall|center|centre|hotel|hub|space/i.test(text);
  if (hasVenue) signals++;

  return { pass: signals >= 2, signals };
}

/**
 * PAGE TYPE GATE: Returns true if the event candidate should proceed to AI.
 * Returns false (with reason) if it should be rejected.
 */
function pageTypeGate(raw: { title: string; description?: string; source_url?: string }): { pass: boolean; reason: string } {
  const url = raw.source_url || "";
  const fullText = `${raw.title} ${raw.description || ""}`;

  // A) Domain check
  const domainStatus = isAllowedDomain(url);
  if (domainStatus === "blocked") {
    return { pass: false, reason: `blocked domain: ${url}` };
  }

  // B) Content rejection — list/article detection
  if (isListArticle(fullText)) {
    return { pass: false, reason: "list/article content detected" };
  }

  // C) For unknown domains, require event structure
  if (domainStatus === "unknown") {
    const structure = hasEventStructure(fullText);
    if (!structure.pass) {
      return { pass: false, reason: `unknown domain, weak event structure (signals=${structure.signals})` };
    }
  }

  // D) Must have SOME date signal (hard reject if no date at all)
  const hasAnyDate = /\d{4}|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b|(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i.test(fullText);
  // Only enforce for non-event-platform sources
  if (domainStatus !== "allowed" && !hasAnyDate) {
    return { pass: false, reason: "no date signal found" };
  }

  return { pass: true, reason: "ok" };
}

// ============ AI CLASSIFICATION ============

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

interface AIClassification {
  relevant: boolean;
  event_type: string;
  tags: string[];
  state: string;
  city: string | null;
  event_date: string | null;
  confidence_score: number;
}

async function classifyWithAI(
  event: { title: string; description?: string; venue?: string; city?: string },
  apiKey: string
): Promise<AIClassification | null> {
  const prompt = `You are a strict Web3 event classifier. Analyze this event and determine if it is genuinely about Web3/blockchain/crypto.

EVENT:
Title: ${event.title}
Description: ${(event.description || "").substring(0, 800)}
Venue: ${event.venue || "N/A"}
City: ${event.city || "N/A"}

RULES:
- ONLY mark relevant=true if Web3/blockchain/crypto is the CORE focus
- Reject generic tech events (AI, SaaS, design, product) unless Web3 is central
- Reject events with weak/passing crypto mentions
- Reject news articles, blog posts, lists, or non-event pages
- Accept niche deep Web3 topics (ZK, MEV, account abstraction, etc.)

Respond with a JSON object using this exact structure:
{
  "relevant": boolean,
  "event_type": "meetup"|"hackathon"|"workshop"|"conference"|"ama"|"online_session"|"bootcamp"|"summit"|"webinar"|"other",
  "tags": string[] (from: defi, nft, dao, zk, layer2, trading, security, identity, gaming, ai+crypto, stablecoin, regulation, smart_contracts, infrastructure, community, education),
  "state": string (Nigerian state name or "Online"),
  "city": string or null,
  "event_date": "YYYY-MM-DD" or null,
  "confidence_score": number 0.0-1.0
}`;

  try {
    const resp = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "You are a strict Web3 event classifier. Output ONLY valid JSON, no markdown." },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
      }),
    });

    if (!resp.ok) {
      console.error(`[AI] Classification failed: ${resp.status}`);
      return null;
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return null;

    const jsonStr = content.replace(/^```json?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
    return JSON.parse(jsonStr) as AIClassification;
  } catch (e) {
    console.error('[AI] Classification error:', e);
    return null;
  }
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
    .replace(/tickets?/gi, '')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .trim();
}

function titleSimilarity(a: string, b: string): number {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (na === nb) return 1.0;
  // Simple token overlap similarity
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
  title: string, date: string | null, link: string | null,
  dedupHash: string, supabase: any
): Promise<boolean> {
  // Check exact hash
  const { data: exactMatch } = await supabase
    .from('events')
    .select('id, title')
    .eq('dedup_hash', dedupHash)
    .maybeSingle();
  if (exactMatch) return true;

  // Check same registration link
  if (link) {
    const { data: linkMatch } = await supabase
      .from('events')
      .select('id')
      .eq('registration_link', link)
      .maybeSingle();
    if (linkMatch) return true;
  }

  // Fuzzy title match: check recent events with same date
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
  }

  return false;
}

// ============ FIRECRAWL (enrichment only) ============

const FIRECRAWL_API_URL = "https://api.firecrawl.dev/v1";

async function enrichLink(link: string, firecrawlApiKey: string): Promise<any | null> {
  try {
    console.log(`[Enrich] Scraping: ${link}`);
    const resp = await fetch(`${FIRECRAWL_API_URL}/scrape`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${firecrawlApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: link, formats: ["markdown"] }),
    });

    if (!resp.ok) {
      console.error(`[Enrich] Failed: ${resp.status}`);
      return null;
    }

    const data = await resp.json();
    const result = data.data || data;
    const markdown = result.markdown || "";
    const title = result.metadata?.title || "";
    const description = result.metadata?.description || markdown.substring(0, 1000);

    if (!title || title.length < 5) return null;

    return {
      title,
      description,
      source_url: link,
      registration_link: link,
      source_platform: "community",
      venue: null,
      city: null,
      event_date: null,
      event_time: null,
      end_date: null,
      organizer: null,
      is_online: false,
      _raw_markdown: markdown,
    };
  } catch (e) {
    console.error('[Enrich] Error:', e);
    return null;
  }
}

// ============ X/TWITTER DISCOVERY via Firecrawl search ============

async function discoverFromXTwitter(firecrawlApiKey: string): Promise<string[]> {
  const links: string[] = [];
  const queries = [
    'site:x.com "web3 event Lagos"',
    'site:x.com "blockchain meetup Nigeria"',
    'site:x.com "crypto conference Africa"',
    'site:x.com "web3 hackathon" Nigeria',
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
        body: JSON.stringify({ query, limit: 5 }),
      });

      if (!resp.ok) {
        console.error(`[X Discovery] Failed for "${query}": ${resp.status}`);
        continue;
      }

      const data = await resp.json();
      const results = data.data || [];

      // Extract links from tweet content
      for (const r of results) {
        const text = `${r.markdown || ""} ${r.description || ""}`;
        // Find Luma, Eventbrite, or other event links
        const urlMatches = text.matchAll(/https?:\/\/(?:lu\.ma|www\.eventbrite\.com|meetup\.com|partiful\.com)[^\s")<\]]+/g);
        for (const m of urlMatches) {
          links.push(m[0]);
        }
      }

      await new Promise(r => setTimeout(r, 500));
    } catch (e) {
      console.error(`[X Discovery] Error:`, e);
    }
  }

  // Deduplicate links
  return [...new Set(links)];
}

// ============ PLATFORM SCRAPERS ============

async function scrapeLumaEvents(): Promise<any[]> {
  const events: any[] = [];
  const queries = [
    "web3+nigeria", "blockchain+lagos", "crypto+nigeria", "web3+africa",
    "blockchain+africa", "defi+nigeria", "nft+lagos",
  ];

  for (const query of queries) {
    try {
      const url = `https://api.lu.ma/public/v2/event/search?query=${query}&pagination_limit=20`;
      console.log(`[Luma] Fetching: ${url}`);
      const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });

      if (!resp.ok) {
        const htmlResp = await fetch(`https://lu.ma/discover?query=${query}`);
        if (htmlResp.ok) {
          const html = await htmlResp.text();
          const titleMatches = html.matchAll(/<h[1-3][^>]*>([^<]{10,100})<\/h[1-3]>/gi);
          for (const m of titleMatches) {
            const title = m[1].trim();
            if (title.length > 10) events.push({ title, source_platform: "luma" });
          }
        }
        continue;
      }

      const data = await resp.json();
      const entries = data.entries || data.data || [];

      for (const entry of entries) {
        const ev = entry.event || entry;
        events.push({
          title: ev.name || ev.title || "",
          description: ev.description || "",
          event_date: ev.start_at ? new Date(ev.start_at).toISOString().split('T')[0] : null,
          event_time: ev.start_at ? new Date(ev.start_at).toTimeString().split(' ')[0] : null,
          end_date: ev.end_at ? new Date(ev.end_at).toISOString().split('T')[0] : null,
          venue: ev.geo_address_info?.full_address || ev.location || null,
          city: ev.geo_address_info?.city || null,
          registration_link: ev.url ? `https://lu.ma/${ev.url}` : null,
          source_url: ev.url ? `https://lu.ma/${ev.url}` : null,
          source_platform: "luma",
          is_online: ev.location_type === "online" || false,
          organizer: ev.hosts?.[0]?.name || null,
        });
      }
    } catch (e) {
      console.error(`[Luma] Error for "${query}":`, e);
    }
  }
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

// ============ HYBRID FILTER PIPELINE ============

async function processEvent(
  raw: any,
  sourceName: string,
  supabase: any,
  lovableApiKey: string,
  stats: any
): Promise<boolean> {
  if (!raw.title || raw.title.length < 5) return false;

  const fullText = `${raw.title || ''} ${raw.description || ''} ${raw.venue || ''} ${raw.city || ''}`;

  // STAGE 0: Page Type Gate
  const gate = pageTypeGate(raw);
  if (!gate.pass) {
    stats.filtered_gate++;
    console.log(`[GATE REJECT] "${raw.title}" — ${gate.reason}`);
    return false;
  }

  // STAGE 1: Keyword pre-filter
  const kwScore = web3KeywordScore(fullText);
  if (kwScore < 2) {
    stats.filtered_keyword++;
    console.log(`[KEYWORD REJECT] "${raw.title}" (score=${kwScore})`);
    return false;
  }

  // STAGE 2: AI classification
  let aiResult: AIClassification | null = null;
  if (lovableApiKey) {
    aiResult = await classifyWithAI(
      { title: raw.title, description: raw.description, venue: raw.venue, city: raw.city },
      lovableApiKey
    );
  }

  if (aiResult) {
    if (!aiResult.relevant || aiResult.confidence_score < 0.5) {
      stats.filtered_ai++;
      console.log(`[AI REJECT] "${raw.title}" (relevant=${aiResult.relevant}, confidence=${aiResult.confidence_score})`);
      return false;
    }
    console.log(`[AI ACCEPT] "${raw.title}" (confidence=${aiResult.confidence_score})`);
  }

  // Build event record
  const state = aiResult?.state || detectState(fullText);
  const eventType = aiResult?.event_type || detectEventType(fullText);
  const isOnline = state === "Online" || raw.is_online || detectIsOnline(fullText);
  const eventDate = aiResult?.event_date || raw.event_date || extractDate(fullText);
  const city = aiResult?.city || raw.city || null;
  const tags = aiResult?.tags || [];
  const confidenceScore = aiResult?.confidence_score || computeConfidence({ ...raw, state, event_date: eventDate });

  const resolvedState = state === "Unknown" ? (isOnline ? "Online" : "Lagos") : state;
  const dedupHash = await generateDedupHash(raw.title, eventDate, resolvedState);

  // STAGE 3: Improved dedup
  const isDupe = await isDuplicateEvent(raw.title, eventDate, raw.registration_link, dedupHash, supabase);
  if (isDupe) {
    stats.duplicates++;
    return false;
  }

  const submissionCount = raw._submission_count || 0;
  const popularityScore = (submissionCount * 0.4) + (confidenceScore * 0.6);

  const { error } = await supabase.from('events').insert({
    title: raw.title.substring(0, 500),
    description: raw.description?.substring(0, 2000) || null,
    city,
    state: resolvedState,
    country: "Nigeria",
    venue: raw.venue || null,
    event_date: eventDate,
    event_time: raw.event_time || null,
    end_date: raw.end_date || null,
    organizer: raw.organizer || null,
    registration_link: raw.registration_link || null,
    source_url: raw.source_url || null,
    event_type: eventType,
    tags,
    is_online: isOnline,
    confidence_score: confidenceScore,
    dedup_hash: dedupHash,
    status: 'upcoming',
    source_platform: raw.source_platform || sourceName,
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
  console.log(`INSERTED: "${raw.title}" [${eventType}] confidence=${confidenceScore}`);
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
      x_discovery: emptyStats(),
    };

    // ---- Phase 1: Scrape platforms in parallel ----
    const [lumaEvents, eventbriteEvents, meetupEvents] = await Promise.all([
      scrapeLumaEvents().catch(e => { results.luma.errors = String(e); return []; }),
      scrapeEventbriteEvents().catch(e => { results.eventbrite.errors = String(e); return []; }),
      scrapeMeetupEvents().catch(e => { results.meetup.errors = String(e); return []; }),
    ]);

    results.luma.found = lumaEvents.length;
    results.eventbrite.found = eventbriteEvents.length;
    results.meetup.found = meetupEvents.length;

    // ---- Phase 1b: X/Twitter discovery → extract event links → enrich with Firecrawl ----
    let xDiscoveredEvents: any[] = [];
    if (firecrawlApiKey) {
      try {
        const xLinks = await discoverFromXTwitter(firecrawlApiKey);
        console.log(`[X Discovery] Found ${xLinks.length} event links from tweets`);
        results.x_discovery.found = xLinks.length;

        for (const link of xLinks.slice(0, 10)) {
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

    // ---- Phase 2: Process all events through pipeline (max 30 per run) ----
    const allRaw = [
      ...lumaEvents.map(e => ({ ...e, _source: 'luma' as const })),
      ...eventbriteEvents.map(e => ({ ...e, _source: 'eventbrite' as const })),
      ...meetupEvents.map(e => ({ ...e, _source: 'meetup' as const })),
      ...xDiscoveredEvents.map(e => ({ ...e, _source: 'x_discovery' as const })),
    ];

    console.log(`Total raw candidates: ${allRaw.length} (max 30 will be processed)`);

    let processed = 0;
    for (const raw of allRaw) {
      if (processed >= 30) break; // Cap per run for performance
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
