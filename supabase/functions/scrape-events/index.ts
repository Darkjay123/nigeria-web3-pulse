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

function extractLinks(text: string): string[] {
  const urlPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
  return text.match(urlPattern) || [];
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

// ============ SCRAPERS ============

async function scrapeLumaEvents(): Promise<any[]> {
  const events: any[] = [];
  const queries = [
    "web3+nigeria", "blockchain+nigeria", "crypto+nigeria", "defi+nigeria",
    "web3+africa", "blockchain+lagos", "web3+meetup", "crypto+africa"
  ];

  for (const query of queries) {
    try {
      const url = `https://api.lu.ma/public/v2/event/search?query=${query}&pagination_limit=20`;
      console.log(`[Luma] Fetching: ${url}`);
      const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
      console.log(`[Luma] Status for "${query}": ${resp.status}`);

      if (!resp.ok) {
        // HTML fallback
        const htmlResp = await fetch(`https://lu.ma/discover?query=${query}`);
        if (htmlResp.ok) {
          const html = await htmlResp.text();
          console.log(`[Luma] HTML fallback length for "${query}": ${html.length}`);
          // Try to extract event titles from HTML
          const titleMatches = html.matchAll(/<h[1-3][^>]*>([^<]{10,100})<\/h[1-3]>/gi);
          for (const m of titleMatches) {
            const title = m[1].trim();
            if (title.length > 10) {
              events.push({ title, source_platform: "luma" });
            }
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

      if (!resp.ok) {
        console.log(`[Eventbrite] Status ${resp.status} for "${query}"`);
        continue;
      }

      const html = await resp.text();
      console.log(`[Eventbrite] HTML length for "${query}": ${html.length}`);

      // Extract JSON-LD structured data
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

      // HTML fallback if no JSON-LD events found
      if (jsonLdCount === 0) {
        console.log(`[Eventbrite] No JSON-LD found for "${query}", trying HTML fallback`);
        const titleMatches = html.matchAll(/data-testid="[^"]*event[^"]*"[^>]*>([^<]+)</gi);
        for (const m of titleMatches) {
          const title = m[1].trim();
          if (title.length > 10) {
            events.push({ title, source_platform: "eventbrite" });
          }
        }
        // Also try og:title extraction
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
      console.log(`[Eventbrite] Extracted ${jsonLdCount} JSON-LD events for "${query}"`);
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

      if (!resp.ok) {
        console.log(`[Meetup] Status ${resp.status}`);
        continue;
      }

      const html = await resp.text();
      console.log(`[Meetup] HTML length: ${html.length}`);

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

    console.log(`Scraped totals: Luma=${lumaEvents.length}, Eventbrite=${eventbriteEvents.length}, Meetup=${meetupEvents.length}`);

    for (const raw of allRaw) {
      try {
        const fullText = `${raw.title || ''} ${raw.description || ''} ${raw.venue || ''} ${raw.city || ''}`;
        const state = raw.state || detectState(fullText);
        const eventType = raw.event_type || detectEventType(fullText);
        const isOnline = raw.is_online ?? detectIsOnline(fullText);
        const eventDate = raw.event_date || extractDate(fullText);

        console.log(`RAW EVENT: "${raw.title}" [${raw._source}] → state=${state}, type=${eventType}`);

        if (!raw.title || raw.title.length < 5) {
          console.log(`SKIP: Title too short: "${raw.title}"`);
          continue;
        }

        // RELAXED FILTER: accept all events (test mode)
        const nigeriaRelated = true;

        const dedupHash = await generateDedupHash(raw.title, eventDate, state);

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
          submission_count: 0,
          popularity_score: 0,
        };

        eventRecord.confidence_score = computeConfidence(eventRecord);
        eventRecord.popularity_score = eventRecord.confidence_score * 0.6;

        const { error } = await supabase.from('events').insert(eventRecord);
        if (error) {
          console.error('Insert error:', error.message);
          results[raw._source].errors += `Insert: ${error.message}; `;
        } else {
          results[raw._source].inserted++;
          console.log(`INSERTED: "${raw.title}"`);
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
    const totalFound = Object.values(results).reduce((s, r) => s + r.found, 0);

    // FAILSAFE: If no events inserted, add a system check event
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
        console.log('FAILSAFE: System check event inserted.');
      }
    }

    // Process unprocessed user submissions into events
    const { data: submissions } = await supabase
      .from('user_submitted_events')
      .select('*')
      .eq('processed', false)
      .limit(20);

    let submissionsProcessed = 0;
    if (submissions && submissions.length > 0) {
      for (const sub of submissions) {
        if (!sub.normalized_title || sub.normalized_title.length < 5) continue;

        const hash = sub.dedup_hash || await generateDedupHash(
          sub.normalized_title, sub.normalized_date, 'Unknown'
        );

        // Check if event already exists
        const { data: existing } = await supabase
          .from('events')
          .select('id, submission_count')
          .eq('dedup_hash', hash)
          .maybeSingle();

        if (existing) {
          // Boost existing event
          const newCount = (existing.submission_count || 0) + sub.submission_count;
          const popularityScore = (newCount * 0.4) + (0.5 * 0.6);
          await supabase.from('events')
            .update({ submission_count: newCount, popularity_score: popularityScore })
            .eq('id', existing.id);
        } else {
          // Insert new event from submission
          const fullText = `${sub.normalized_title} ${sub.raw_text || ''} ${sub.link || ''}`;
          await supabase.from('events').insert({
            title: sub.normalized_title.substring(0, 500),
            description: sub.raw_text?.substring(0, 2000) || null,
            state: detectState(fullText) || 'Unknown',
            event_date: sub.normalized_date || null,
            registration_link: sub.link || null,
            source_url: sub.link || null,
            source_platform: 'community',
            event_type: detectEventType(fullText),
            is_online: detectIsOnline(fullText),
            dedup_hash: hash,
            status: 'upcoming',
            confidence_score: 0.4,
            submission_count: sub.submission_count,
            popularity_score: (sub.submission_count * 0.4) + (0.4 * 0.6),
          });
        }

        await supabase.from('user_submitted_events')
          .update({ processed: true })
          .eq('id', sub.id);
        submissionsProcessed++;
      }
    }

    console.log(`Pipeline complete. Inserted ${totalInserted} scraped, processed ${submissionsProcessed} submissions.`);

    return new Response(JSON.stringify({
      ok: true,
      scrape_results: results,
      submissions: { processed: submissionsProcessed },
      total_events: totalFound,
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
