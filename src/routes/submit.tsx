import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Send, Loader2 } from "lucide-react";

export const Route = createFileRoute("/submit")({
  component: SubmitPage,
  head: () => ({
    meta: [
      { title: "Submit an Event — NextChain Radar" },
      { name: "description", content: "Suggest a Web3 event for NextChain Radar. Submissions are reviewed by our intelligence pipeline." },
    ],
  }),
});

const schema = z.object({
  link: z.string().trim().url("Must be a valid URL").max(500),
  raw_text: z.string().trim().max(2000).optional(),
});

function SubmitPage() {
  const [link, setLink] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ link, raw_text: notes || undefined });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("user_submitted_events").insert({
      link: parsed.data.link,
      raw_text: parsed.data.raw_text || null,
      submission_count: 1,
    });
    setLoading(false);

    if (error) {
      toast.error("Submission failed: " + error.message);
    } else {
      toast.success("Thanks! Your event will be reviewed by our pipeline.");
      setLink("");
      setNotes("");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="mb-8">
          <h1 className="font-heading text-3xl font-bold text-foreground">Submit an Event</h1>
          <p className="mt-2 text-muted-foreground">
            Know about a Web3 event in Nigeria? Drop the link — our intelligence pipeline will validate and publish it.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-border bg-card p-6">
          <div>
            <Label htmlFor="link" className="text-foreground">Event Link *</Label>
            <Input
              id="link"
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://lu.ma/your-event or https://x.com/..."
              className="mt-1.5 bg-surface border-border text-foreground"
              required
            />
            <p className="mt-1 text-xs text-muted-foreground">Lu.ma, Eventbrite, Meetup, X/Twitter, or any event page.</p>
          </div>

          <div>
            <Label htmlFor="notes" className="text-foreground">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything else we should know?"
              rows={3}
              maxLength={2000}
              className="mt-1.5 bg-surface border-border text-foreground"
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Submit Event
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            All submissions pass through AI validation. Spam, blogs, and listicles are automatically rejected.
          </p>
        </form>
      </div>
    </div>
  );
}
