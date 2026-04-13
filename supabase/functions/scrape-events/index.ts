import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { crypto } from 'https://deno.land/std@0.208.0/crypto/mod.ts';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/telegram';

// Nigerian states for mapping
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

function detectState(text: string): string {
  const lower = text.toLowerCase();
  
  if (lower.includes("online") || lower.includes("virtual") || lower.includes("remote")) {
    return "Online";
  }
  
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
  // Try common date patterns
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
        if (!isNaN(d.getTime())) {
          return d.toISOString().split('T')[0];
        }
      } catch { /* continue */ }
    }
  }
  return null;
}

function extractLinks(text: string): string[] {
  const urlPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
  return text.match(urlPattern) || [];
}

function computeConfidence(event: any): number {
  let score = 0.2; // base
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

// ============ SCRAPERS ============

async function scrapeLumaEvents(): Promise<any[]> {
  const events: any[] = [];
  const queries = ["web3+nigeria", "blockchain+nigeria", "crypto+nigeria", "defi+nigeria"];
  
  for (const query of queries) {
    try {
      const url = `https://api.lu.ma/public/v2/event/search?query=${query}&pagination_limit=20`;
      const resp = await fetch(url, {
        headers: { 'Accept': 'application/json' }
      });
      
      if (!resp.ok) {
        // Try alternative: scrape the HTML page
        const htmlResp = await fetch(`https://lu.ma/discover?query=${query}`);
        if (htmlResp.ok) {
          const html = await htmlResp.text();
          // Extract event data from HTML
          const titleMatches = html.matchAll(/class="[^"]*event-title[^"]*"[^>]*>([^<]+)</g);
          for (const m of titleMatches) {
            events.push({
              title: m[1].trim(),
              source_platform: "luma",
            });
          }
        }
        continue;
      }
      
      const data = await resp.json();
      if (data.entries) {
        for (const entry of data.entries) {
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
      }
    } catch (e) {
      console.error(`Luma scrape error for "${query}":`, e);
    }
  }
  
  return events;
}

async function scrapeEventbriteEvents(): Promise<any[]> {
  const events: any[] = [];
  const queries = ["web3", "blockchain", "crypto", "defi", "nft"];
  
  for (const query of queries) {
    try {
      const url = `https://www.eventbrite.com/d/nigeria/${query}/`;
      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; NextChainRadar/1.0)',
          'Accept': 'text/html,application/xhtml+xml',
        }
      });
      
      if (!resp.ok) continue;
      
      const html = await resp.text();
      
      // Extract JSON-LD structured data
      const jsonLdMatches = html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
      for (const m of jsonLdMatches) {
        try {
          const ld = JSON.parse(m[1]);
          const items = Array.isArray(ld) ? ld : [ld];
          for (const item of items) {
            if (item['@type'] === 'Event') {
              events.push({
                title: item.name || "",
                description: item.description || "",
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
    } catch (e) {
      console.error(`Eventbrite scrape error for "${query}":`, e);
    }
  }
  
  return events;
}

async function scrapeMeetupEvents(): Promise<any[]> {
  const events: any[] = [];
  
  try {
    // Use Meetup's GraphQL-like search
    const url = 'https://www.meetup.com/find/?keywords=web3+blockchain+crypto&location=ng--Lagos';
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NextChainRadar/1.0)',
        'Accept': 'text/html',
      }
    });
    
    if (resp.ok) {
      const html = await resp.text();
      // Extract JSON-LD
      const jsonLdMatches = html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
      for (const m of jsonLdMatches) {
        try {
          const ld = JSON.parse(m[1]);
          const items = Array.isArray(ld) ? ld : [ld];
          for (const item of items) {
            if (item['@type'] === 'Event') {
              events.push({
                title: item.name || "",
                description: item.description || "",
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
    }
  } catch (e) {
    console.error('Meetup scrape error:', e);
  }
  
  return events;
}

// ============ MAIN HANDLER ============

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const results = {
      luma: { found: 0, inserted: 0, duplicates: 0, errors: '' },
      eventbrite: { found: 0, inserted: 0, duplicates: 0, errors: '' },
      meetup: { found: 0, inserted: 0, duplicates: 0, errors: '' },
    };

    // Run all scrapers in parallel
    const [lumaEvents, eventbriteEvents, meetupEvents] = await Promise.all([
      scrapeLumaEvents().catch(e => { results.luma.errors = String(e); return []; }),
      scrapeEventbriteEvents().catch(e => { results.eventbrite.errors = String(e); return []; }),
      scrapeMeetupEvents().catch(e => { results.meetup.errors = String(e); return []; }),
    ]);

    const allRaw = [
      ...lumaEvents.map(e => ({ ...e, _source: 'luma' as const })),
      ...eventbriteEvents.map(e => ({ ...e, _source: 'eventbrite' as const })),
      ...meetupEvents.map(e => ({ ...e, _source: 'meetup' as const })),
    ];

    results.luma.found = lumaEvents.length;
    results.eventbrite.found = eventbriteEvents.length;
    results.meetup.found = meetupEvents.length;

    console.log(`Scraped: Luma=${lumaEvents.length}, Eventbrite=${eventbriteEvents.length}, Meetup=${meetupEvents.length}`);

    // Process and insert each event
    for (const raw of allRaw) {
      try {
        const fullText = `${raw.title || ''} ${raw.description || ''} ${raw.venue || ''} ${raw.city || ''}`;
        const state = raw.state || detectState(fullText);
        const eventType = raw.event_type || detectEventType(fullText);
        const isOnline = raw.is_online ?? detectIsOnline(fullText);
        const eventDate = raw.event_date || extractDate(fullText);
        
        if (!raw.title || raw.title.length < 5) continue;
        
        // Filter: must be Nigeria-related or online
        const nigeriaRelated = fullText.toLowerCase().includes('nigeria') || 
          state !== "Unknown" || isOnline;
        if (!nigeriaRelated) continue;

        const dedupHash = await generateDedupHash(raw.title, eventDate, state);

        // Check for existing event with same hash
        const { data: existing } = await supabase
          .from('events')
          .select('id')
          .eq('dedup_hash', dedupHash)
          .maybeSingle();

        if (existing) {
          results[raw._source].duplicates++;
          continue;
        }

        const eventRecord = {
          title: raw.title.substring(0, 500),
          description: raw.description?.substring(0, 2000) || null,
          city: raw.city || null,
          state: state === "Unknown" ? (isOnline ? "Online" : "Lagos") : state,
          country: "Nigeria",
          venue: raw.venue || null,
          event_date: eventDate,
          event_time: raw.event_time || null,
          end_date: raw.end_date || null,
          organizer: raw.organizer || null,
          registration_link: raw.registration_link || null,
          source_url: raw.source_url || null,
          event_type: eventType,
          tags: [],
          is_online: isOnline,
          confidence_score: 0,
          dedup_hash: dedupHash,
          status: 'upcoming' as const,
          source_platform: raw.source_platform || null,
          image_url: null,
        };

        eventRecord.confidence_score = computeConfidence(eventRecord);

        const { error } = await supabase.from('events').insert(eventRecord);
        if (error) {
          console.error('Insert error:', error);
          results[raw._source].errors += `Insert: ${error.message}; `;
        } else {
          results[raw._source].inserted++;
        }
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

    const totalInserted = Object.values(results).reduce((s, r) => s + r.inserted, 0);
    console.log(`Pipeline complete. Inserted ${totalInserted} new events.`);

    return new Response(JSON.stringify({ ok: true, results }), {
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
