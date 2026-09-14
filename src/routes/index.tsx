import { createFileRoute } from "@tanstack/react-router";
import { HeroSection } from "@/components/HeroSection";
import { StatsBar } from "@/components/StatsBar";
import { EventFeed } from "@/components/EventFeed";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "NextChain Radar — Nigeria's Web3 Event Intelligence" },
      { name: "description", content: "Discover every Web3, crypto, and blockchain event across Nigeria's 36 states. Auto-updated, multi-source intelligence engine." },
    ],
  }),
});

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <HeroSection />
      <main className="mx-auto max-w-7xl px-4 py-10 space-y-8">
        <StatsBar />
        <EventFeed />
      </main>
    </div>
  );
}
