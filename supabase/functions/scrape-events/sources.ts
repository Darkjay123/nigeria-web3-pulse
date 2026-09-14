// ============================================================================
// sources.ts — free-first candidate discovery (v13)
//
// The v12 pipeline routed EVERY source through Firecrawl. When Firecrawl hit
// HTTP 402 the whole engine produced zero events. These providers use public
// endpoints with no API key and no per-request cost, so the pipeline keeps
// producing even with zero Firecrawl credit. Firecrawl is now enrichment only.
// ============================================================================

export interface RawCandidate {
  title: string;
  description: string;
  source_url: string | null;
  registration_link: string | null;
  source_platform: string;
  venue: string | null;
  city: string | null;
  event_date: string | null;
  event_time: string | null;
  end_date: string | null;
  organizer: string | null;
  is_online: boolean;
  image_url?: string | null;
  metadata?: { event_date?: string | null };
  /** structured sources with complete metadata skip the AI round-trip */
  trusted_metadata?: boolean;
  _submission_count?: number;
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function getText(url: string, timeoutMs = 12000): Promise<string | null> {
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!r.ok) {
      console.warn(`[fetch] ${r.status} ${url}`);
      return null;
    }
    return await r.text();
  } catch (e) {
    console.warn(`[fetch] failed ${url}: ${e}`);
    return null;
  }
}

function nextData(html: string): any | null {
  const m = html.match(/id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

function splitIso(iso: string | null | undefined): {
  date: string | null;
  time: string | null;
} {
  if (!iso) return { date: null, time: null };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { date: null, time: null };
  const s = d.toISOString();
  return { date: s.split("T")[0], time: s.split("T")[1].substring(0, 8) };
}

// ---------------------------------------------------------------- Luma -----
// lu.ma city pages ship the full event list inside __NEXT_DATA__ — name,
// start/end, location type and slug. No key, no credits, one request per city.
const LUMA_CITY_PAGES = [
  "https://lu.ma/lagos",
  "https://lu.ma/abuja",
  "https://lu.ma/nigeria",
  "https://lu.ma/port-harcourt",
];

export async function fetchLumaCityEvents(): Promise<RawCandidate[]> {
  const out: RawCandidate[] = [];
  const seen = new Set<string>();

  const pages = await Promise.all(LUMA_CITY_PAGES.map((u) => getText(u)));

  for (const html of pages) {
    if (!html) continue;
    const data = nextData(html);
    const entries =
      data?.props?.pageProps?.initialData?.data?.events ??
      data?.props?.pageProps?.initialData?.data?.entries ??
      [];
    for (const entry of entries) {
      const ev = entry?.event ?? entry;
      if (!ev?.name) continue;
      const slug = ev.url ? `https://lu.ma/${ev.url}` : null;
      const key = slug || ev.api_id;
      if (!key || seen.has(key)) continue;
      seen.add(key);

      const start = splitIso(ev.start_at);
      const end = splitIso(ev.end_at);
      const geo = entry?.calendar ?? ev?.geo_address_info ?? {};
      const city =
        ev?.geo_address_info?.city_state ||
        ev?.geo_address_info?.city ||
        entry?.geo_address_info?.city ||
        null;

      out.push({
        title: String(ev.name).trim(),
        description: String(ev.description_short || geo?.description || "").trim(),
        source_url: slug,
        registration_link: slug,
        source_platform: "luma",
        venue:
          ev?.geo_address_info?.address ||
          ev?.geo_address_info?.full_address ||
          null,
        city,
        event_date: start.date,
        event_time: start.time,
        end_date: end.date,
        organizer: entry?.calendar?.name || null,
        is_online: ev.location_type === "online" || ev.location_type === "virtual",
        image_url: ev.cover_url || null,
        metadata: { event_date: start.date },
        trusted_metadata: !!start.date,
      });
    }
  }

  console.log(`[Luma] ${out.length} candidates from ${LUMA_CITY_PAGES.length} city pages`);
  return out;
}

// -------------------------------------------------------------- Meetup -----
// Meetup's search page embeds the Apollo result set in __NEXT_DATA__, with
// title, eventUrl, dateTime and venue. The old JSON-LD scrape returned nothing.
const MEETUP_SEARCHES = [
  "https://www.meetup.com/find/?keywords=web3&location=ng--Lagos&source=EVENTS",
  "https://www.meetup.com/find/?keywords=blockchain&location=ng--Lagos&source=EVENTS",
  "https://www.meetup.com/find/?keywords=crypto&location=ng--Abuja&source=EVENTS",
  "https://www.meetup.com/find/?keywords=web3&location=ng--Abuja&source=EVENTS",
];

export async function fetchMeetupEvents(): Promise<RawCandidate[]> {
  const out: RawCandidate[] = [];
  const seen = new Set<string>();

  const pages = await Promise.all(MEETUP_SEARCHES.map((u) => getText(u, 15000)));

  for (const html of pages) {
    if (!html) continue;
    const data = nextData(html);
    if (!data) continue;
    const blob = JSON.stringify(data);

    // Apollo normalises every event into its own object; pull them by shape
    // rather than by a brittle path that changes between Meetup releases.
    const nodes = blob.match(/\{"__typename":"Event".*?\}(?=,"|\})/g) || [];
    const seenUrls = new Set<string>();
    for (const node of nodes) {
      const url = node.match(/"eventUrl":"([^"]+)"/)?.[1];
      const title = node.match(/"title":"([^"]+)"/)?.[1];
      const when = node.match(/"dateTime":"([^"]+)"/)?.[1];
      const end = node.match(/"endTime":"([^"]+)"/)?.[1];
      const desc = node.match(/"description":"([^"]{0,900})"/)?.[1] || "";
      const group = node.match(/"name":"([^"]+)"/)?.[1] || null;
      const venue = node.match(/"venue":\{[^}]*"name":"([^"]+)"/)?.[1] || null;
      const city = node.match(/"city":"([^"]+)"/)?.[1] || null;
      const online = /"eventType":"ONLINE"/.test(node);
      if (!url || !title || seenUrls.has(url)) continue;
      seenUrls.add(url);
      if (seen.has(url)) continue;
      seen.add(url);

      const start = splitIso(when);
      out.push({
        title: JSON.parse(`"${title}"`),
        description: desc ? JSON.parse(`"${desc}"`) : "",
        source_url: url,
        registration_link: url,
        source_platform: "meetup",
        venue,
        city,
        event_date: start.date,
        event_time: start.time,
        end_date: splitIso(end).date,
        organizer: group,
        is_online: online,
        metadata: { event_date: start.date },
        trusted_metadata: !!start.date,
      });
    }
  }

  console.log(`[Meetup] ${out.length} candidates from ${MEETUP_SEARCHES.length} searches`);
  return out;
}

// ------------------------------------------------------ JSON-LD scraper -----
// Community calendars and org sites that publish schema.org Event markup.
// Cheap, deterministic, no provider in the middle.
export const COMMUNITY_CALENDARS = [
  "https://www.web3lagos.com/",
  "https://blockchainnigeria.com/events/",
];

export function extractJsonLdEvents(html: string, sourceUrl: string): RawCandidate[] {
  const out: RawCandidate[] = [];
  const blocks =
    html.matchAll(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ) || [];
  for (const b of blocks) {
    let parsed: any;
    try {
      parsed = JSON.parse(b[1].trim());
    } catch {
      continue;
    }
    const items = Array.isArray(parsed) ? parsed : parsed["@graph"] || [parsed];
    for (const item of items) {
      const t = item?.["@type"];
      const isEvent =
        t === "Event" ||
        (Array.isArray(t) && t.includes("Event")) ||
        (typeof t === "string" && /Event$/.test(t));
      if (!isEvent || !item.name) continue;
      const start = splitIso(item.startDate);
      const url = item.url || sourceUrl;
      out.push({
        title: String(item.name).trim(),
        description: String(item.description || "").substring(0, 1500),
        source_url: url,
        registration_link: item.offers?.url || url,
        source_platform: "community",
        venue: item.location?.name || null,
        city:
          item.location?.address?.addressLocality ||
          item.location?.address?.addressRegion ||
          null,
        event_date: start.date,
        event_time: start.time,
        end_date: splitIso(item.endDate).date,
        organizer:
          item.organizer?.name ||
          (typeof item.organizer === "string" ? item.organizer : null),
        is_online:
          String(item.eventAttendanceMode || "").includes("Online") ||
          item.location?.["@type"] === "VirtualLocation",
        image_url: typeof item.image === "string" ? item.image : item.image?.[0] || null,
        metadata: { event_date: start.date },
        trusted_metadata: !!start.date,
      });
    }
  }
  return out;
}

export async function fetchCommunityCalendars(
  urls: string[] = COMMUNITY_CALENDARS,
): Promise<RawCandidate[]> {
  const pages = await Promise.all(
    urls.map(async (u) => ({ url: u, html: await getText(u) })),
  );
  const out: RawCandidate[] = [];
  for (const p of pages) {
    if (!p.html) continue;
    out.push(...extractJsonLdEvents(p.html, p.url));
  }
  console.log(`[Community] ${out.length} candidates from ${urls.length} calendars`);
  return out;
}

// -------------------------------------------------------------- Nitter -----
// Kept from v12, still free, still discovery-mode only.
const NITTER_INSTANCES = [
  "nitter.privacydev.net",
  "nitter.poast.org",
  "xcancel.com",
  "nitter.net",
];

export async function fetchNitter(queries: string[]): Promise<RawCandidate[]> {
  const tweets: RawCandidate[] = [];

  // One query per instance in parallel, first healthy body wins per query.
  const results = await Promise.all(
    queries.map(async (query) => {
      for (const inst of NITTER_INSTANCES) {
        const body = await getText(
          `https://${inst}/search/rss?f=tweets&q=${encodeURIComponent(query)}`,
          8000,
        );
        if (!body) continue;
        if (/not\s+yet\s+whitelisted|rate\s*limit|instance\s+has\s+been\s+blocked/i.test(body))
          continue;
        if (!body.includes("<item")) continue;
        return { query, xml: body };
      }
      return null;
    }),
  );

  for (const r of results) {
    if (!r) continue;
    const items = r.xml.match(/<item[\s\S]*?<\/item>/g) || [];
    for (const item of items.slice(0, 6)) {
      const grab = (tag: string) => {
        const m = item.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
        if (!m) return "";
        return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
      };
      const title = grab("title").replace(/<[^>]+>/g, "");
      const link = grab("link");
      const desc = grab("description")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (!title || title.length < 10 || !link) continue;
      const xUrl = link.replace(/^https?:\/\/[^/]+/, "https://x.com");
      tweets.push({
        title: title.substring(0, 240),
        description: (desc || title).substring(0, 1500),
        source_url: xUrl,
        registration_link: xUrl,
        source_platform: "nitter",
        venue: null,
        city: null,
        event_date: null,
        event_time: null,
        end_date: null,
        organizer: null,
        is_online: /twitter\s+space|x\s+space|virtual|online|zoom/i.test(desc + " " + title),
      });
    }
  }
  console.log(`[Nitter] ${tweets.length} candidates`);
  return tweets;
}
