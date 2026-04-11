import { Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NIGERIAN_STATES, EVENT_TYPES } from "@/lib/constants";
import type { EventFilters as Filters } from "@/lib/types";

interface Props {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

export function EventFilters({ filters, onChange }: Props) {
  const update = (key: keyof Filters, value: string) =>
    onChange({ ...filters, [key]: value });

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search events..."
          value={filters.search}
          onChange={(e) => update("search", e.target.value)}
          className="pl-10 bg-surface border-border text-foreground placeholder:text-muted-foreground"
        />
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <SlidersHorizontal className="h-4 w-4" />
        <span>Filters</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Select value={filters.state} onValueChange={(v) => update("state", v)}>
          <SelectTrigger className="bg-surface border-border text-foreground">
            <SelectValue placeholder="All States" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All States</SelectItem>
            {NIGERIAN_STATES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.eventType} onValueChange={(v) => update("eventType", v)}>
          <SelectTrigger className="bg-surface border-border text-foreground">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {EVENT_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.isOnline} onValueChange={(v) => update("isOnline", v)}>
          <SelectTrigger className="bg-surface border-border text-foreground">
            <SelectValue placeholder="All Formats" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Formats</SelectItem>
            <SelectItem value="physical">Physical</SelectItem>
            <SelectItem value="online">Online</SelectItem>
          </SelectContent>
        </Select>

        <Input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => update("dateFrom", e.target.value)}
          className="bg-surface border-border text-foreground"
          placeholder="From date"
        />
      </div>
    </div>
  );
}
