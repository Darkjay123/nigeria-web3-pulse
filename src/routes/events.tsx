import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EventCard } from "@/components/EventCard";
import { EventFilters } from "@/components/EventFilters";
import type { Event, EventFilters as Filters } from "@/lib/types";

export const Route = createFileRoute("/events")({
  component: EventsPage,
  head: () => ({
    meta: [
      { title: "All Events — NextChain Radar" },
      { name: "description", content: "Browse and filter all Web3, crypto, and blockchain events across Nigeria." },
    ],
  }),
});

const defaultFilters: Filters = {
  search: "",
  state: "all",
  eventType: "all",
  isOnline: "all",
  dateFrom: "",
  dateTo: "",
};

function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    setLoading(true);
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .order("event_date", { ascending: true, nullsFirst: false });

    if (!error && data) {
      setEvents(data as unknown as Event[]);
    }
    setLoading(false);
  }

  const filtered = events.filter((e) => {
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const match =
        e.title.toLowerCase().includes(q) ||
        e.description?.toLowerCase().includes(q) ||
        e.organizer?.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (filters.state !== "all" && e.state !== filters.state) return false;
    if (filters.eventType !== "all" && e.event_type !== filters.eventType) return false;
    if (filters.isOnline === "online" && !e.is_online) return false;
    if (filters.isOnline === "physical" && e.is_online) return false;
    if (filters.dateFrom && e.event_date && e.event_date < filters.dateFrom) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-10 space-y-8">
        <div>
          <h1 className="font-heading text-3xl font-bold text-foreground">All Events</h1>
          <p className="mt-1 text-muted-foreground">
            {filtered.length} event{filtered.length !== 1 ? "s" : ""} found
          </p>
        </div>

        <EventFilters filters={filters} onChange={setFilters} />

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-64 animate-pulse rounded-xl border border-border bg-card" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <p className="text-lg font-heading text-foreground">No events found</p>
            <p className="mt-2 text-sm text-muted-foreground">Try different filters.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
