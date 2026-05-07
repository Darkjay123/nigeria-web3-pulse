import { Calendar, MapPin, Clock, Globe, Users, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Event } from "@/lib/types";
import { format, parseISO } from "date-fns";

function getEventTypeColor(type: string) {
  const map: Record<string, string> = {
    hackathon: "bg-chart-3/20 text-chart-3 border-chart-3/30",
    meetup: "bg-primary/20 text-primary border-primary/30",
    workshop: "bg-chart-2/20 text-chart-2 border-chart-2/30",
    conference: "bg-chart-4/20 text-chart-4 border-chart-4/30",
    ama: "bg-chart-5/20 text-chart-5 border-chart-5/30",
    webinar: "bg-radar-cyan/20 text-radar-cyan border-radar-cyan/30",
  };
  return map[type] || "bg-muted text-muted-foreground border-border";
}

export function EventCard({ event }: { event: Event }) {
  const dateStr = event.event_date
    ? format(parseISO(event.event_date), "MMM d, yyyy")
    : "TBD";

  return (
    <Card className="group border-border bg-card transition-all duration-300 card-glow-hover hover:border-primary/40">
      <CardContent className="p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={getEventTypeColor(event.event_type)}>
              {event.event_type.replace("_", " ")}
            </Badge>
            {event.is_online && (
              <Badge variant="outline" className="border-radar-cyan/30 bg-radar-cyan/10 text-radar-cyan">
                <Globe className="mr-1 h-3 w-3" /> Online
              </Badge>
            )}
            {event.status === "pending_review" && (
              <Badge variant="outline" className="border-chart-4/30 bg-chart-4/10 text-chart-4">
                Pending review
              </Badge>
            )}
          </div>
          {event.confidence_score && (
            <span className="shrink-0 text-xs text-muted-foreground">
              {Math.round(Number(event.confidence_score) * 100)}% conf
            </span>
          )}
        </div>

        <h3 className="mb-2 font-heading text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
          {event.title}
        </h3>

        {event.description && (
          <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">
            {event.description}
          </p>
        )}

        <div className="mb-4 space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <span>{dateStr}</span>
            {event.event_time && (
              <>
                <Clock className="ml-2 h-4 w-4 text-primary" />
                <span>{event.event_time.slice(0, 5)}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            <span>
              {event.venue ? `${event.venue}, ` : ""}
              {event.city ? `${event.city}, ` : ""}
              {event.state}
            </span>
          </div>
          {event.organizer && (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span>{event.organizer}</span>
            </div>
          )}
        </div>

        {event.tags && event.tags.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1">
            {event.tags.slice(0, 4).map((tag) => (
              <Badge key={tag} variant="secondary" className="bg-muted text-xs text-muted-foreground">
                {tag}
              </Badge>
            ))}
            {event.tags.length > 4 && (
              <Badge variant="secondary" className="bg-muted text-xs text-muted-foreground">
                +{event.tags.length - 4}
              </Badge>
            )}
          </div>
        )}

        {event.registration_link && (
          <a
            href={event.registration_link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
          >
            Register <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </CardContent>
    </Card>
  );
}
