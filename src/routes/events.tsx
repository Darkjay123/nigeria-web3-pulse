import { createFileRoute } from "@tanstack/react-router";
import { EventFeed } from "@/components/EventFeed";

export const Route = createFileRoute("/events")({
  component: EventsPage,
  head: () => ({
    meta: [
      { title: "All Events — NextChain Radar" },
      { name: "description", content: "Browse and filter all Web3, crypto, and blockchain events across Nigeria." },
    ],
  }),
});

function EventsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-10 space-y-8">
        <EventFeed
          header={(count) => (
            <div>
              <h1 className="font-heading text-3xl font-bold text-foreground">All Events</h1>
              <p className="mt-1 text-muted-foreground">
                {count} event{count !== 1 ? "s" : ""} found
              </p>
            </div>
          )}
        />
      </div>
    </div>
  );
}
