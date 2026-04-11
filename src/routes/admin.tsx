import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { NIGERIAN_STATES, EVENT_TYPES, EVENT_TAGS } from "@/lib/constants";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({
    meta: [
      { title: "Admin — NextChain Radar" },
      { name: "description", content: "Add and manage Web3 events on NextChain Radar." },
    ],
  }),
});

function AdminPage() {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    city: "",
    state: "",
    venue: "",
    event_date: "",
    event_time: "",
    end_date: "",
    organizer: "",
    registration_link: "",
    source_url: "",
    event_type: "meetup" as string,
    is_online: false,
    tags: [] as string[],
    source_platform: "manual",
  });

  const updateField = (key: string, value: unknown) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const toggleTag = (tag: string) => {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter((t) => t !== tag)
        : [...prev.tags, tag],
    }));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.title || !form.state) {
      toast.error("Title and State are required");
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("events").insert({
      title: form.title,
      description: form.description || null,
      city: form.city || null,
      state: form.state,
      venue: form.venue || null,
      event_date: form.event_date || null,
      event_time: form.event_time || null,
      end_date: form.end_date || null,
      organizer: form.organizer || null,
      registration_link: form.registration_link || null,
      source_url: form.source_url || null,
      event_type: form.event_type as "meetup",
      is_online: form.is_online,
      tags: form.tags,
      source_platform: form.source_platform,
      confidence_score: 1.0,
      status: "upcoming" as "upcoming",
    });

    setLoading(false);

    if (error) {
      toast.error("Failed to add event: " + error.message);
    } else {
      toast.success("Event added successfully!");
      setForm({
        title: "", description: "", city: "", state: "", venue: "",
        event_date: "", event_time: "", end_date: "", organizer: "",
        registration_link: "", source_url: "", event_type: "meetup",
        is_online: false, tags: [], source_platform: "manual",
      });
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-8">
          <h1 className="font-heading text-3xl font-bold text-foreground">Add Event</h1>
          <p className="mt-1 text-muted-foreground">Manually add a Web3 event to the database.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-border bg-card p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="title" className="text-foreground">Event Title *</Label>
              <Input id="title" value={form.title} onChange={(e) => updateField("title", e.target.value)}
                className="mt-1.5 bg-surface border-border text-foreground" placeholder="e.g. Lagos DeFi Hackathon" />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="desc" className="text-foreground">Description</Label>
              <Textarea id="desc" value={form.description} onChange={(e) => updateField("description", e.target.value)}
                className="mt-1.5 bg-surface border-border text-foreground" rows={3} />
            </div>

            <div>
              <Label className="text-foreground">State *</Label>
              <Select value={form.state} onValueChange={(v) => updateField("state", v)}>
                <SelectTrigger className="mt-1.5 bg-surface border-border text-foreground">
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {NIGERIAN_STATES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="city" className="text-foreground">City</Label>
              <Input id="city" value={form.city} onChange={(e) => updateField("city", e.target.value)}
                className="mt-1.5 bg-surface border-border text-foreground" />
            </div>

            <div>
              <Label htmlFor="venue" className="text-foreground">Venue</Label>
              <Input id="venue" value={form.venue} onChange={(e) => updateField("venue", e.target.value)}
                className="mt-1.5 bg-surface border-border text-foreground" />
            </div>

            <div>
              <Label className="text-foreground">Event Type</Label>
              <Select value={form.event_type} onValueChange={(v) => updateField("event_type", v)}>
                <SelectTrigger className="mt-1.5 bg-surface border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="event_date" className="text-foreground">Event Date</Label>
              <Input id="event_date" type="date" value={form.event_date}
                onChange={(e) => updateField("event_date", e.target.value)}
                className="mt-1.5 bg-surface border-border text-foreground" />
            </div>

            <div>
              <Label htmlFor="event_time" className="text-foreground">Event Time</Label>
              <Input id="event_time" type="time" value={form.event_time}
                onChange={(e) => updateField("event_time", e.target.value)}
                className="mt-1.5 bg-surface border-border text-foreground" />
            </div>

            <div>
              <Label htmlFor="organizer" className="text-foreground">Organizer</Label>
              <Input id="organizer" value={form.organizer} onChange={(e) => updateField("organizer", e.target.value)}
                className="mt-1.5 bg-surface border-border text-foreground" />
            </div>

            <div>
              <Label htmlFor="reg_link" className="text-foreground">Registration Link</Label>
              <Input id="reg_link" type="url" value={form.registration_link}
                onChange={(e) => updateField("registration_link", e.target.value)}
                className="mt-1.5 bg-surface border-border text-foreground" />
            </div>

            <div className="flex items-center gap-2 sm:col-span-2">
              <Checkbox id="is_online" checked={form.is_online}
                onCheckedChange={(v) => updateField("is_online", Boolean(v))} />
              <Label htmlFor="is_online" className="text-foreground">This is an online event</Label>
            </div>
          </div>

          <div>
            <Label className="text-foreground">Tags</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {EVENT_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    form.tags.includes(tag)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Add Event
          </Button>
        </form>
      </div>
    </div>
  );
}
