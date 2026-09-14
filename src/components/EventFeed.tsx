import { useState } from "react";
import { EventCard } from "@/components/EventCard";
import { EventFilters } from "@/components/EventFilters";
import { useEvents } from "@/hooks/use-events";
import type { EventFilters as Filters } from "@/lib/types";

export const defaultFilters: Filters = {
  search: "",
  state: "all",
  eventType: "all",
  isOnline: "all",
  dateFrom: "",
  dateTo: "",
};

export function EventFeed({ header }: { header?: (count: number) => React.ReactNode }) {
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const { data: events = [], isPending, isError } = useEvents(filters);

  // Past events sink to the bottom; everything else is already ordered by the
  // database, so there is no second sort pass over the full list here.
  const sorted = [...events].sort((a, b) => {
    const rank = (s: string) => (s === "completed" ? 1 : 0);
    const r = rank(a.status) - rank(b.status);
    if (r !== 0) return r;
    const da = a.event_date ?? "9999-12-31";
    const db = b.event_date ?? "9999-12-31";
    return rank(a.status) === 1 ? db.localeCompare(da) : da.localeCompare(db);
  });

  return (
    <>
      {header?.(events.length)}
      <EventFilters filters={filters} onChange={setFilters} />

      {isPending ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-destructive/30 bg-card p-12 text-center">
          <p className="text-lg font-heading text-foreground">Couldn't load events</p>
          <p className="mt-2 text-sm text-muted-foreground">Check your connection and try again.</p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <p className="text-lg font-heading text-foreground">No events found</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Try adjusting your filters or check back later.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sorted.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </>
  );
}
