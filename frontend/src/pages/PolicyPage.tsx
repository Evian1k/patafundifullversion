import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import SiteLayout from "@/components/layout/SiteLayout";
import Markdown from "@/components/content/Markdown";
import { apiClient } from "@/lib/api";

type PolicySection = { id: string; title: string; content: string; order: number };
type Policy = {
  slug: string;
  title: string;
  version: string;
  updated_at?: string;
  published_at?: string;
  sections: PolicySection[];
};

export default function PolicyPage({ slug: slugProp }: { slug?: string }) {
  const params = useParams();
  const slug = slugProp || params.slug || "";
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiClient.request(`/policies/${slug}`, { includeAuth: false });
        if (!cancelled) setPolicy(data.policy);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load policy");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <SiteLayout>
      <div className="container mx-auto px-4 py-10 md:py-14">
        {loading ? (
          <div className="max-w-3xl">
            <div className="h-8 w-3/4 bg-muted animate-pulse rounded mb-4" />
            <div className="h-4 w-1/2 bg-muted animate-pulse rounded mb-10" />
            <div className="space-y-3">
              <div className="h-4 bg-muted animate-pulse rounded" />
              <div className="h-4 bg-muted animate-pulse rounded" />
              <div className="h-4 bg-muted animate-pulse rounded" />
            </div>
          </div>
        ) : error ? (
          <div className="max-w-3xl">
            <h1 className="text-2xl font-bold mb-3">Unable to load</h1>
            <p className="text-muted-foreground">{error}</p>
          </div>
        ) : policy ? (
          <div className="max-w-3xl">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">{policy.title}</h1>
            <p className="text-sm text-muted-foreground mb-10">Version {policy.version}</p>

            <div className="space-y-10">
              {policy.sections?.map((s) => (
                <section key={s.id} className="space-y-3">
                  <h2 className="text-xl font-semibold">{s.title}</h2>
                  <Markdown content={s.content} />
                </section>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </SiteLayout>
  );
}

