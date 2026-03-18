import { useEffect, useState } from "react";
import SiteLayout from "@/components/layout/SiteLayout";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Job = {
  slug: string;
  title: string;
  department?: string | null;
  location?: string | null;
  employment_type?: string | null;
  description: string;
  requirements?: string | null;
};

export default function Careers() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Job | null>(null);
  const [app, setApp] = useState({ fullName: "", email: "", phone: "", message: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await apiClient.request("/careers/jobs", { includeAuth: false });
        if (!cancelled) setJobs(data.jobs || []);
      } catch (e: any) {
        toast.error(e?.message || "Failed to load careers");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async () => {
    if (!selected) return;
    if (!app.fullName.trim() || !app.email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    setSubmitting(true);
    try {
      await apiClient.request("/careers/apply", {
        method: "POST",
        includeAuth: false,
        body: { jobSlug: selected.slug, fullName: app.fullName, email: app.email, phone: app.phone, message: app.message },
      });
      toast.success("Application submitted");
      setApp({ fullName: "", email: "", phone: "", message: "" });
    } catch (e: any) {
      toast.error(e?.message || "Failed to submit application");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SiteLayout>
      <div className="container mx-auto px-4 py-10 md:py-14">
        <div className="max-w-4xl">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Careers</h1>
          <p className="text-muted-foreground mt-2">
            Build the future of trusted local services with PataFundi.
          </p>

          <div className="mt-10 grid lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Open roles</h2>
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />
                  ))}
                </div>
              ) : jobs.length === 0 ? (
                <p className="text-muted-foreground">No open roles right now.</p>
              ) : (
                <div className="space-y-3">
                  {jobs.map((j) => (
                    <button
                      key={j.slug}
                      onClick={() => setSelected(j)}
                      className={`w-full text-left rounded-2xl border p-5 bg-card hover:bg-accent/30 transition-colors ${
                        selected?.slug === j.slug ? "ring-2 ring-primary/40" : ""
                      }`}
                    >
                      <div className="font-semibold">{j.title}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {[j.department, j.location, j.employment_type].filter(Boolean).join(" • ")}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border bg-card p-6">
              {!selected ? (
                <div>
                  <h2 className="text-lg font-semibold">Apply</h2>
                  <p className="text-sm text-muted-foreground mt-2">
                    Select a role to view details and submit your application.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-semibold">{selected.title}</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {[selected.department, selected.location, selected.employment_type].filter(Boolean).join(" • ")}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-semibold">Role overview</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selected.description}</p>
                    {selected.requirements ? (
                      <>
                        <h3 className="font-semibold pt-3">Requirements</h3>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selected.requirements}</p>
                      </>
                    ) : null}
                  </div>

                  <div className="space-y-3">
                    <Input
                      value={app.fullName}
                      onChange={(e) => setApp((s) => ({ ...s, fullName: e.target.value }))}
                      placeholder="Full name"
                    />
                    <Input
                      value={app.email}
                      onChange={(e) => setApp((s) => ({ ...s, email: e.target.value }))}
                      placeholder="Email"
                      type="email"
                    />
                    <Input
                      value={app.phone}
                      onChange={(e) => setApp((s) => ({ ...s, phone: e.target.value }))}
                      placeholder="Phone (optional)"
                    />
                    <Textarea
                      value={app.message}
                      onChange={(e) => setApp((s) => ({ ...s, message: e.target.value }))}
                      placeholder="Tell us why you’re a great fit (optional)"
                    />
                    <Button disabled={submitting} onClick={submit} variant="hero">
                      {submitting ? "Submitting…" : "Submit application"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}

