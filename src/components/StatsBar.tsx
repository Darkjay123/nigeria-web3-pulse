import { Radar, CalendarDays, MapPin, Wifi } from "lucide-react";
import type { Event } from "@/lib/types";

export function StatsBar({ events }: { events: Event[] }) {
  const upcoming = events.filter((e) => e.status === "upcoming").length;
  const states = new Set(events.map((e) => e.state)).size;
  const online = events.filter((e) => e.is_online).length;

  const stats = [
    { icon: Radar, label: "Total Events", value: events.length, color: "text-primary" },
    { icon: CalendarDays, label: "Upcoming", value: upcoming, color: "text-radar-cyan" },
    { icon: MapPin, label: "States", value: states, color: "text-chart-4" },
    { icon: Wifi, label: "Online", value: online, color: "text-chart-5" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="rounded-xl border border-border bg-card p-4 card-glow">
          <div className="flex items-center gap-3">
            <div className={`rounded-lg bg-muted p-2 ${s.color}`}>
              <s.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold font-heading text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
