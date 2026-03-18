import SiteLayout from "@/components/layout/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api";
import { useState } from "react";
import { toast } from "sonner";

export default function ContactSupport() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!form.message.trim()) {
      toast.error("Message is required");
      return;
    }
    setSubmitting(true);
    try {
      await apiClient.request("/support/ticket", {
        method: "POST",
        includeAuth: true,
        body: { ...form, category: "support", priority: "normal" },
      });
      toast.success("Support ticket created");
      setForm({ name: "", email: "", subject: "", message: "" });
    } catch (e: any) {
      toast.error(e?.message || "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SiteLayout>
      <div className="container mx-auto px-4 py-10 md:py-14">
        <div className="max-w-2xl">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Contact Support</h1>
          <p className="text-muted-foreground mt-2">
            Send us a message and our team will respond as soon as possible.
          </p>

          <div className="mt-8 space-y-3 rounded-2xl border bg-card p-6">
            <div className="grid sm:grid-cols-2 gap-3">
              <Input
                value={form.name}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                placeholder="Name (optional)"
              />
              <Input
                value={form.email}
                onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                placeholder="Email (optional)"
                type="email"
              />
            </div>
            <Input
              value={form.subject}
              onChange={(e) => setForm((s) => ({ ...s, subject: e.target.value }))}
              placeholder="Subject (optional)"
            />
            <Textarea
              value={form.message}
              onChange={(e) => setForm((s) => ({ ...s, message: e.target.value }))}
              placeholder="How can we help?"
              className="min-h-[140px]"
            />
            <Button variant="hero" onClick={submit} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit"}
            </Button>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}

