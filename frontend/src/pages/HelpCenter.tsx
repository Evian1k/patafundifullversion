import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import SiteLayout from "@/components/layout/SiteLayout";
import { apiClient } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Category = { id: string; slug: string; title: string; description?: string | null; category_order: number };
type Faq = {
  id: string;
  question: string;
  answer: string;
  faq_order: number;
  category_slug: string;
  category_title: string;
};

export default function HelpCenter() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const category = params.get("category") || "";

  const [categories, setCategories] = useState<Category[]>([]);
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async (next: { q?: string; category?: string } = {}) => {
    const nextQ = typeof next.q === "string" ? next.q : q;
    const nextCat = typeof next.category === "string" ? next.category : category;

    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (nextQ) qs.set("q", nextQ);
      if (nextCat) qs.set("category", nextCat);
      const data = await apiClient.request(`/help?${qs.toString()}`, { includeAuth: false });
      setCategories(data.categories || []);
      setFaqs(data.faqs || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load Help Center");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, category]);

  const catTitle = useMemo(() => {
    const c = categories.find((c) => c.slug === category);
    return c?.title || "All Categories";
  }, [categories, category]);

  return (
    <SiteLayout>
      <div className="container mx-auto px-4 py-10 md:py-14">
        <div className="max-w-3xl">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Help Center</h1>
          <p className="text-muted-foreground mt-2">
            Search FAQs or contact support if you can’t find an answer.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Input
              value={q}
              onChange={(e) => {
                const v = e.target.value;
                setParams((p) => {
                  if (v) p.set("q", v);
                  else p.delete("q");
                  return p;
                });
              }}
              placeholder="Search help topics…"
            />
            <Link to="/contact-support">
              <Button variant="hero">Contact Support</Button>
            </Link>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={category ? "outline" : "secondary"}
              onClick={() =>
                setParams((p) => {
                  p.delete("category");
                  return p;
                })
              }
            >
              All
            </Button>
            {categories.map((c) => (
              <Button
                key={c.slug}
                size="sm"
                variant={c.slug === category ? "secondary" : "outline"}
                onClick={() =>
                  setParams((p) => {
                    p.set("category", c.slug);
                    return p;
                  })
                }
              >
                {c.title}
              </Button>
            ))}
          </div>

          <div className="mt-10">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 className="text-xl font-semibold">{catTitle}</h2>
              {q ? <Badge variant="secondary">Search: {q}</Badge> : null}
            </div>

            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : error ? (
              <p className="text-muted-foreground">{error}</p>
            ) : faqs.length === 0 ? (
              <p className="text-muted-foreground">
                No matching FAQs.{" "}
                <Link className="underline underline-offset-4" to="/contact-support">
                  Contact Support
                </Link>
                .
              </p>
            ) : (
              <div className="space-y-4">
                {faqs.map((f) => (
                  <div key={f.id} className="rounded-2xl border bg-card p-6">
                    <div className="text-xs text-muted-foreground mb-2">{f.category_title}</div>
                    <h3 className="text-base font-semibold">{f.question}</h3>
                    <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{f.answer}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-12 rounded-2xl border bg-card p-6">
            <h3 className="font-semibold">Need urgent help?</h3>
            <p className="text-sm text-muted-foreground mt-1">
              If you suspect fraud, abuse, or safety risk, use{" "}
              <Link to="/report-problem" className="underline underline-offset-4">
                Report a Problem
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}

