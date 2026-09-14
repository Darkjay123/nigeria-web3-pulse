import { Radar, CalendarDays, MapPin, Wifi } from "lucide-react";
import { useEventStats } from "@/hooks/use-events";

export function StatsBar() {
  const { data } = useEventStats();

  const stats = [
    { icon: Radar, label: "Total Events", value: data?.total, color: "text-primary" },
    { icon: CalendarDays, label: "Upcoming", value: data?.upcoming, color: "text-radar-cyan" },
    { icon: MapPin, label: "States", value: data?.states, color: "text-chart-4" },
    { icon: Wifi, label: "Online", value: data?.online, color: "text-chart-5" },
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
              <p className="text-2xl font-bold font-heading text-foreground">
                {s.value ?? "—"}
              </p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
