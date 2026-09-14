import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Event, EventFilters } from "@/lib/types";

// Columns the cards actually render. `select("*")` pulled dedup hashes, raw
// scraped descriptions and source metadata into every browser for every row.
const CARD_COLUMNS =
  "id,title,description,city,state,country,venue,event_date,event_time,end_date,organizer,registration_link,source_url,event_type,tags,is_online,confidence_score,status,source_platform,image_url,created_at";

export interface EventsQuery extends EventFilters {
  limit?: number;
}

/**
 * Filtering used to happen in the browser over the entire events table: every
 * visit downloaded all rows, then threw most of them away. The filters now run
 * in Postgres against the existing indexes, and results are cached per filter
 * combination so re-filtering is instant.
 */
export function useEvents(filters: EventsQuery) {
  return useQuery({
    queryKey: ["events", filters],
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<Event[]> => {
      let q = supabase
        .from("events")
        .select(CARD_COLUMNS)
        .neq("status", "rejected");

      if (filters.state !== "all") q = q.eq("state", filters.state);
      // event_type is a Postgres enum; the filter arrives as a plain string.
      if (filters.eventType !== "all") q = q.eq("event_type", filters.eventType as never);
      if (filters.isOnline === "online") q = q.eq("is_online", true);
      if (filters.isOnline === "physical") q = q.eq("is_online", false);
      if (filters.dateFrom) q = q.gte("event_date", filters.dateFrom);
      if (filters.dateTo) q = q.lte("event_date", filters.dateTo);
      if (filters.search.trim()) {
        const term = filters.search.trim().replace(/[%,()]/g, " ");
        q = q.or(
          `title.ilike.%${term}%,description.ilike.%${term}%,organizer.ilike.%${term}%,city.ilike.%${term}%`,
        );
      }

      const { data, error } = await q
        .order("status", { ascending: true })
        .order("event_date", { ascending: true, nullsFirst: false })
        .limit(filters.limit ?? 200);

      if (error) throw error;
      return (data ?? []) as unknown as Event[];
    },
  });
}

/** Headline counts, computed in Postgres instead of over a full table download. */
export function useEventStats() {
  return useQuery({
    queryKey: ["event-stats"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const base = () => supabase.from("events").select("id", { count: "exact", head: true }).neq("status", "rejected");
      const [total, upcoming, online, states] = await Promise.all([
        base(),
        base().eq("status", "upcoming"),
        base().eq("is_online", true),
        supabase.from("events").select("state").neq("status", "rejected").limit(2000),
      ]);
      return {
        total: total.count ?? 0,
        upcoming: upcoming.count ?? 0,
        online: online.count ?? 0,
        states: new Set((states.data ?? []).map((r: { state: string }) => r.state)).size,
      };
    },
  });
}
