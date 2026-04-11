import heroBg from "@/assets/hero-bg.jpg";
import { Radar } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="absolute inset-0">
        <img
          src={heroBg}
          alt=""
          className="h-full w-full object-cover opacity-30"
          width={1920}
          height={800}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-20 text-center md:py-28">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm text-primary">
          <Radar className="h-4 w-4 radar-pulse" />
          Live Intelligence Engine
        </div>

        <h1 className="mx-auto max-w-3xl font-heading text-4xl font-bold leading-tight text-foreground md:text-6xl">
          Nigeria's Web3 Event{" "}
          <span className="text-primary text-glow">Radar</span>
        </h1>

        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          Discover every blockchain meetup, hackathon, and conference happening across
          all 36 states. Powered by autonomous intelligence.
        </p>

        <div className="mt-8 flex items-center justify-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-primary radar-pulse" />
            Auto-updating
          </span>
          <span className="text-border">•</span>
          <span>36+ States</span>
          <span className="text-border">•</span>
          <span>Multi-source</span>
        </div>
      </div>
    </section>
  );
}
