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

const fetchText = getText;

async function fetchJson<T>(url: string, timeoutMs = 12000): Promise<T | null> {
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!r.ok) {
      console.warn(`[fetch] ${r.status} ${url}`);
      return null;
    }
    return (await r.json()) as T;
  } catch (e) {
    console.warn(`[fetch] failed ${url}: ${e}`);
    return null;
  }
}

const NITTER_INSTANCES = [
  "nitter.privacydev.net",
  "nitter.poast.org",
  "xcancel.com",
  "nitter.net",
];

function normalizeCity(raw: string): string | null {
  const v = (raw || "").split(",")[0].trim();
  if (!v) return null;
  return v.replace(/\s+/g, " ").slice(0, 60);
}

export async function fetchLumaCityEvents(): Promise<RawCandidate[]> {
  // lu.ma's public discovery API. Keyword queries beat city pages: a city page is
  // whatever is trending there, while these return Nigeria-wide web3 events with
  // full structured metadata (start_at, geo, cover, url) and no API key.
  const QUERIES = [
    'nigeria',
    'lagos web3',
    'abuja blockchain',
    'nigeria crypto',
    'nigeria blockchain',
    'lagos crypto',
    'port harcourt tech',
    'african web3',
  ];

  const seen = new Set<string>();
  const out: RawCandidate[] = [];

  const pages = await Promise.all(
    QUERIES.map((q) =>
      fetchJson<LumaDiscoverResponse>(
        `https://api.lu.ma/discover/get-paginated-events?period=future&pagination_limit=50&query=${encodeURIComponent(q)}`,
      ).catch(() => null),
    ),
  );

  for (let i = 0; i < pages.length; i++) {
    const entries = pages[i]?.entries ?? [];
    for (const entry of entries) {
      const ev = (entry as any)?.event ?? entry;
      const apiId: string | undefined = ev?.api_id;
      const url: string | undefined = ev?.url ? `https://lu.ma/${ev.url}` : undefined;
      const key = apiId ?? url;
      if (!key || seen.has(key) || !url) continue;

      const geo = ev?.geo_address_info ?? {};
      const cityState: string = geo?.city_state ?? '';
      const country: string = geo?.country ?? '';
      const address: string = geo?.full_address ?? geo?.address ?? '';
      const haystack = `${cityState} ${country} ${address}`.toLowerCase();

      const isOnline = ev?.location_type === 'online' || ev?.location_type === 'zoom';
      const nigerian =
        /nigeria|lagos|abuja|ibadan|benin city|port harcourt|enugu|kano|ilorin|calabar|uyo|abeokuta|jos|owerri|awka|akure|zaria|kaduna|asaba|warri/.test(
          haystack,
        ) || /\bnigeria\b|\blagos\b|\babuja\b/.test(String(ev?.name ?? '').toLowerCase());

      // Online events only count when the title/host ties them to Nigeria, or we
      // would import the whole global calendar.
      if (!nigerian && !isOnline) continue;
      if (!nigerian && isOnline) continue;

      seen.add(key);
      const { date, time } = splitIso(ev?.start_at);
      out.push({
        title: String(ev?.name ?? '').trim(),
        description: String(ev?.description_short ?? ev?.one_liner ?? '').trim(),
        event_date: date,
        event_time: time,
        venue: ev?.geo_address_info?.address ?? null,
        city: normalizeCity(cityState || address),
        is_online: isOnline,
        registration_link: url,
        source_platform: 'luma',
        source_url: url,
        image_url: ev?.cover_url ?? null,
        organizer: (entry as any)?.calendar?.name ?? null,
        trusted_metadata: Boolean(date),
      });
    }
  }

  console.log(`[Luma] ${out.length} Nigerian candidates from ${QUERIES.length} discovery queries`);
  return out;
}

interface LumaDiscoverResponse {
  entries?: unknown[];
  has_more?: boolean;
}

export async function fetchMeetupEvents(): Promise<RawCandidate[]> {
  const SEARCHES = [
    'https://www.meetup.com/find/?keywords=web3&location=ng--Lagos&source=EVENTS',
    'https://www.meetup.com/find/?keywords=blockchain&location=ng--Lagos&source=EVENTS',
    'https://www.meetup.com/find/?keywords=crypto&location=ng--Abuja&source=EVENTS',
    'https://www.meetup.com/find/?keywords=blockchain&location=ng--Nigeria&source=EVENTS',
  ];

  const seen = new Set<string>();
  const out: RawCandidate[] = [];

  const pages = await Promise.all(SEARCHES.map((u) => fetchText(u).catch(() => null)));

  for (const html of pages) {
    if (!html) continue;
    const data = extractNextData(html);
    if (!data) continue;

    // Walk the whole payload instead of regex-slicing it: Meetup reshapes this
    // blob often, but an event object always carries an eventUrl plus a start time.
    for (const node of walkObjects(data)) {
      const url = typeof node.eventUrl === 'string' ? node.eventUrl : null;
      if (!url || !url.includes('/events/')) continue;
      const title = typeof node.title === 'string' ? node.title : typeof node.name === 'string' ? node.name : '';
      if (!title) continue;
      const iso =
        (typeof node.dateTime === 'string' && node.dateTime) ||
        (typeof node.startTime === 'string' && node.startTime) ||
        null;
      const clean = url.split('?')[0];
      if (seen.has(clean)) continue;
      seen.add(clean);

      const venueObj = (node.venue ?? {}) as Record<string, unknown>;
      const city = typeof venueObj.city === 'string' ? venueObj.city : null;
      const { date, time } = splitIso(iso);

      out.push({
        title: title.trim(),
        description: typeof node.description === 'string' ? node.description.slice(0, 600) : '',
        event_date: date,
        event_time: time,
        venue: typeof venueObj.name === 'string' ? venueObj.name : null,
        city: normalizeCity(city ?? ''),
        is_online: node.eventType === 'ONLINE' || node.isOnline === true,
        registration_link: clean,
        source_platform: 'meetup',
        source_url: clean,
        image_url: null,
        organizer: typeof (node.group as any)?.name === 'string' ? (node.group as any).name : null,
        trusted_metadata: Boolean(date),
      });
    }
  }

  console.log(`[Meetup] ${out.length} candidates from ${SEARCHES.length} searches`);
  return out;
}

const extractNextData = nextData;

function* walkObjects(root: unknown, depth = 0): Generator<Record<string, any>> {
  if (depth > 14 || root === null || typeof root !== 'object') return;
  if (Array.isArray(root)) {
    for (const item of root) yield* walkObjects(item, depth + 1);
    return;
  }
  yield root as Record<string, any>;
  for (const value of Object.values(root as Record<string, unknown>)) {
    if (value && typeof value === 'object') yield* walkObjects(value, depth + 1);
  }
}

export async function fetchCommunityCalendars(feeds: string[] = []): Promise<RawCandidate[]> {
  // Deliberately empty by default. Community calendar URLs are operator data, not
  // code: the pipeline passes in whatever is configured, so a dead domain can be
  // swapped without a redeploy and we never ship a guessed URL.
  if (!feeds.length) {
    console.log('[Community] no calendars configured, skipping lane');
    return [];
  }

  const out: RawCandidate[] = [];
  const pages = await Promise.all(feeds.map((u) => fetchText(u).catch(() => null)));

  for (let i = 0; i < pages.length; i++) {
    const html = pages[i];
    if (!html) continue;
    out.push(...extractJsonLdEvents(html, feeds[i]));
  }

  console.log(`[Community] ${out.length} candidates from ${feeds.length} calendars`);
  return out;
}

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
