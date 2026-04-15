import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    const parsed = JSON.parse(jsonStr);
    return parsed as AIClassification;
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

async function generateDedupHash(title: string, date: string | null, state: string): Promise<string> {
  const raw = `${title.toLowerCase().trim()}|${date || ''}|${state}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
}

// ============ FIRECRAWL SEARCH SCRAPER ============

const FIRECRAWL_API_URL = "https://api.firecrawl.dev/v1";

async function scrapeWithFirecrawl(firecrawlApiKey: string): Promise<any[]> {
  const events: any[] = [];
  const searchQueries = [
    "web3 events Nigeria 2026",
    "blockchain meetup Lagos 2026",
    "crypto conference Africa 2026",
    "web3 hackathon Nigeria",
  ];

  for (const query of searchQueries) {
    try {
      console.log(`[Firecrawl] Searching: "${query}"`);
      const resp = await fetch(`${FIRECRAWL_API_URL}/search`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${firecrawlApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          limit: 10,
          scrapeOptions: { formats: ["markdown"] },
        }),
      });

      if (!resp.ok) {
        console.error(`[Firecrawl] Search failed for "${query}": ${resp.status}`);
        continue;
      }

      const data = await resp.json();
      const results = data.data || [];
      console.log(`[Firecrawl] Found ${results.length} results for "${query}"`);

      for (const result of results) {
        const markdown = result.markdown || "";
        const title = result.title || result.metadata?.title || "";
        const url = result.url || "";
        const description = result.description || markdown.substring(0, 500);

        if (!title || title.length < 10) continue;

        events.push({
          title,
          description,
          source_url: url,
          registration_link: url,
          source_platform: "firecrawl",
          venue: null,
          city: null,
          event_date: null,
          event_time: null,
          end_date: null,
          organizer: null,
          is_online: false,
        });
      }

      // Rate limit: small delay between searches
      await new Promise(r => setTimeout(r, 500));
    } catch (e) {
      console.error(`[Firecrawl] Error for "${query}":`, e);
    }
  }

  // Deduplicate by title similarity
  const seen = new Set<string>();
  return events.filter(e => {
    const key = e.title.toLowerCase().substring(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ============ PLATFORM SCRAPERS ============

async function scrapeLumaEvents(): Promise<any[]> {
  const events: any[] = [];
  const queries = [
    "web3+nigeria", "blockchain+nigeria", "crypto+nigeria", "defi+nigeria",
    "web3+africa", "blockchain+lagos", "web3+meetup", "crypto+africa",
    "web3+lagos", "blockchain+africa", "nft+nigeria", "dao+nigeria",
    "web3+abuja", "defi+africa", "ethereum+nigeria", "solana+nigeria",
  ];

  for (const query of queries) {
    try {
      const url = `https://api.lu.ma/public/v2/event/search?query=${query}&pagination_limit=20`;
      console.log(`[Luma] Fetching: ${url}`);
      const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
      console.log(`[Luma] Status for "${query}": ${resp.status}`);

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
      console.log(`[Luma] Found ${entries.length} entries for "${query}"`);

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
      console.log(`[Eventbrite] Fetching: ${url}`);
      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
        }
      });

      if (!resp.ok) { console.log(`[Eventbrite] Status ${resp.status} for "${query}"`); continue; }

      const html = await resp.text();
      console.log(`[Eventbrite] HTML length for "${query}": ${html.length}`);

      const jsonLdMatches = html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
      let jsonLdCount = 0;
      for (const m of jsonLdMatches) {
        try {
          const ld = JSON.parse(m[1]);
          const items = Array.isArray(ld) ? ld : [ld];
          for (const item of items) {
            if (item['@type'] === 'Event') {
              jsonLdCount++;
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
        } catch { /* skip invalid JSON-LD */ }
      }

      if (jsonLdCount === 0) {
        const linkMatches = html.matchAll(/href="(https:\/\/www\.eventbrite\.com\/e\/[^"]+)"/g);
        for (const m of linkMatches) {
          const slug = m[1].split('/e/')[1]?.replace(/-tickets-\d+$/, '')?.replace(/-/g, ' ');
          if (slug && slug.length > 10) {
            events.push({
              title: slug.charAt(0).toUpperCase() + slug.slice(1),
              registration_link: m[1],
              source_url: m[1],
              source_platform: "eventbrite",
            });
          }
        }
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
      console.log(`[Meetup] Fetching: ${url}`);
      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html',
        }
      });

      if (!resp.ok) { console.log(`[Meetup] Status ${resp.status}`); continue; }

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

// ============ ENRICHMENT: Scrape a submitted link for full event data ============

async function enrichSubmittedLink(link: string, firecrawlApiKey: string): Promise<any | null> {
  try {
    console.log(`[Enrich] Scraping submitted link: ${link}`);
    const resp = await fetch(`${FIRECRAWL_API_URL}/scrape`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${firecrawlApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: link,
        formats: ["markdown"],
      }),
    });

    if (!resp.ok) {
      console.error(`[Enrich] Firecrawl scrape failed: ${resp.status}`);
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

  // STAGE 1: Keyword pre-filter
  const kwScore = web3KeywordScore(fullText);
  if (kwScore < 2) {
    stats.filtered_keyword++;
    console.log(`[KEYWORD REJECT] "${raw.title}" (score=${kwScore})`);
    return false;
  }
  console.log(`[KEYWORD PASS] "${raw.title}" (score=${kwScore})`);

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
    console.log(`[AI ACCEPT] "${raw.title}" (confidence=${aiResult.confidence_score}, type=${aiResult.event_type})`);
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

  const { data: existing } = await supabase
    .from('events')
    .select('id')
    .eq('dedup_hash', dedupHash)
    .maybeSingle();

  if (existing) {
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
    status: 'upcoming' as const,
    source_platform: raw.source_platform || sourceName,
    image_url: null,
    submission_count: submissionCount,
    popularity_score: popularityScore,
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

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    const results: Record<string, any> = {
      luma: { found: 0, inserted: 0, duplicates: 0, filtered_keyword: 0, filtered_ai: 0, errors: '' },
      eventbrite: { found: 0, inserted: 0, duplicates: 0, filtered_keyword: 0, filtered_ai: 0, errors: '' },
      meetup: { found: 0, inserted: 0, duplicates: 0, filtered_keyword: 0, filtered_ai: 0, errors: '' },
      firecrawl: { found: 0, inserted: 0, duplicates: 0, filtered_keyword: 0, filtered_ai: 0, errors: '' },
    };

    // Scrape all sources in parallel
    const scrapePromises: Promise<any[]>[] = [
      scrapeLumaEvents().catch(e => { results.luma.errors = String(e); return []; }),
      scrapeEventbriteEvents().catch(e => { results.eventbrite.errors = String(e); return []; }),
      scrapeMeetupEvents().catch(e => { results.meetup.errors = String(e); return []; }),
    ];

    if (firecrawlApiKey) {
      scrapePromises.push(
        scrapeWithFirecrawl(firecrawlApiKey).catch(e => { results.firecrawl.errors = String(e); return []; })
      );
    }

    const [lumaEvents, eventbriteEvents, meetupEvents, firecrawlEvents = []] = await Promise.all(scrapePromises);

    const allRaw = [
      ...lumaEvents.map(e => ({ ...e, _source: 'luma' as const })),
      ...eventbriteEvents.map(e => ({ ...e, _source: 'eventbrite' as const })),
      ...meetupEvents.map(e => ({ ...e, _source: 'meetup' as const })),
      ...firecrawlEvents.map(e => ({ ...e, _source: 'firecrawl' as const })),
    ];

    results.luma.found = lumaEvents.length;
    results.eventbrite.found = eventbriteEvents.length;
    results.meetup.found = meetupEvents.length;
    results.firecrawl.found = firecrawlEvents.length;

    console.log(`Scraped totals: Luma=${lumaEvents.length}, Eventbrite=${eventbriteEvents.length}, Meetup=${meetupEvents.length}, Firecrawl=${firecrawlEvents.length}`);

    // Process events through hybrid filter pipeline
    for (const raw of allRaw) {
      try {
        await processEvent(raw, raw._source, supabase, lovableApiKey, results[raw._source]);
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

    const totalInserted = Object.values(results).reduce((s: number, r: any) => s + r.inserted, 0);
    const totalFound = Object.values(results).reduce((s: number, r: any) => s + r.found, 0);
    const totalKeywordFiltered = Object.values(results).reduce((s: number, r: any) => s + r.filtered_keyword, 0);
    const totalAIFiltered = Object.values(results).reduce((s: number, r: any) => s + r.filtered_ai, 0);

    // FAILSAFE
    if (totalInserted === 0 && totalFound === 0) {
      console.log('FAILSAFE: No events found. Inserting system check event.');
      const today = new Date().toISOString().split('T')[0];
      const hash = await generateDedupHash('Test Web3 Event (System Check)', today, 'Online');
      const { data: existingCheck } = await supabase
        .from('events')
        .select('id')
        .eq('dedup_hash', hash)
        .maybeSingle();

      if (!existingCheck) {
        await supabase.from('events').insert({
          title: 'Test Web3 Event (System Check)',
          description: 'Automated system check event to verify pipeline is working.',
          state: 'Online',
          is_online: true,
          event_date: today,
          source_platform: 'system',
          event_type: 'other',
          status: 'upcoming',
          dedup_hash: hash,
          confidence_score: 0.2,
          submission_count: 0,
          popularity_score: 0.12,
        });
      }
    }

    // Process unprocessed user submissions with FULL enrichment
    const { data: submissions } = await supabase
      .from('user_submitted_events')
      .select('*')
      .eq('processed', false)
      .limit(20);

    let submissionsProcessed = 0;
    let submissionsAccepted = 0;
    if (submissions && submissions.length > 0) {
      for (const sub of submissions) {
        // Try to enrich the link with Firecrawl
        let enrichedEvent: any = null;
        if (sub.link && firecrawlApiKey) {
          enrichedEvent = await enrichSubmittedLink(sub.link, firecrawlApiKey);
        }

        if (enrichedEvent) {
          // Run enriched event through the full hybrid pipeline
          enrichedEvent._submission_count = sub.submission_count;
          const subStats = { inserted: 0, filtered_keyword: 0, filtered_ai: 0, duplicates: 0, errors: '' };
          const accepted = await processEvent(enrichedEvent, 'community', supabase, lovableApiKey, subStats);
          if (accepted) submissionsAccepted++;
        } else if (sub.normalized_title && sub.normalized_title.length >= 5) {
          // Fallback: insert with basic data if no enrichment possible
          const hash = sub.dedup_hash || await generateDedupHash(sub.normalized_title, sub.normalized_date, 'Unknown');
          const { data: existing } = await supabase
            .from('events')
            .select('id, submission_count')
            .eq('dedup_hash', hash)
            .maybeSingle();

          if (existing) {
            const newCount = (existing.submission_count || 0) + sub.submission_count;
            const popularityScore = (newCount * 0.4) + (0.5 * 0.6);
            await supabase.from('events')
              .update({ submission_count: newCount, popularity_score: popularityScore })
              .eq('id', existing.id);
          }
        }

        await supabase.from('user_submitted_events')
          .update({ processed: true })
          .eq('id', sub.id);
        submissionsProcessed++;
      }
    }

    console.log(`Pipeline complete. Found=${totalFound}, KeywordFiltered=${totalKeywordFiltered}, AIFiltered=${totalAIFiltered}, Inserted=${totalInserted}, Submissions=${submissionsProcessed}, SubAccepted=${submissionsAccepted}`);

    return new Response(JSON.stringify({
      ok: true,
      scrape_results: results,
      submissions: { processed: submissionsProcessed, accepted: submissionsAccepted },
      total_events: totalFound,
      total_inserted: totalInserted,
      total_keyword_filtered: totalKeywordFiltered,
      total_ai_filtered: totalAIFiltered,
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
