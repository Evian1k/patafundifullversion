import SiteLayout from "@/components/layout/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api";
import { useState } from "react";
import { toast } from "sonner";

const categories = [
  { value: "fraud", label: "Fraud / Scam" },
  { value: "abuse", label: "Abuse / Harassment" },
  { value: "payment", label: "Payment Issue" },
  { value: "fake-fundi", label: "Fake Fundi / Impersonation" },
  { value: "safety", label: "Safety Concern" },
  { value: "other", label: "Other" },
];

export default function ReportProblem() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "", category: "fraud" });
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
        body: { ...form, category: form.category, priority: "high" },
      });
      toast.success("Report submitted as high priority");
      setForm({ name: "", email: "", subject: "", message: "", category: "fraud" });
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
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Report a Problem</h1>
          <p className="text-muted-foreground mt-2">
            Use this form for fraud, abuse, safety, or serious platform issues. Reports are treated as high priority.
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
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="relative">
                <select
                  value={form.category}
                  onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {categories.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                value={form.subject}
                onChange={(e) => setForm((s) => ({ ...s, subject: e.target.value }))}
                placeholder="Subject (optional)"
              />
            </div>
            <Textarea
              value={form.message}
              onChange={(e) => setForm((s) => ({ ...s, message: e.target.value }))}
              placeholder="Describe the problem. Include job ID, usernames, and any evidence you have."
              className="min-h-[160px]"
            />
            <Button variant="hero" onClick={submit} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit Report"}
            </Button>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}

