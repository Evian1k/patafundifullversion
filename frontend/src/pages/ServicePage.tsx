import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import SiteLayout from "@/components/layout/SiteLayout";
import { apiClient } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Fundi = {
  id: string;
  name: string;
  location?: string | null;
  skills: string[];
  experienceYears: number;
  rating: number;
  reviewCount: number;
};

export default function ServicePage() {
  const { slug = "" } = useParams();
  const [service, setService] = useState<{ slug: string; name: string; description: string } | null>(null);
  const [fundis, setFundis] = useState<Fundi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiClient.request(`/services/${slug}`, { includeAuth: false });
        if (!cancelled) {
          setService(data.service);
          setFundis(data.fundis || []);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load service");
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
        <div className="max-w-4xl">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to Home
          </Link>

          {loading ? (
            <div className="mt-6">
              <div className="h-8 w-1/2 bg-muted animate-pulse rounded mb-3" />
              <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
            </div>
          ) : error ? (
            <div className="mt-6">
              <h1 className="text-2xl font-bold">Unable to load</h1>
              <p className="text-muted-foreground mt-2">{error}</p>
            </div>
          ) : service ? (
            <>
              <div className="mt-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{service.name}</h1>
                  <p className="text-muted-foreground mt-2">{service.description}</p>
                </div>
                <Link to="/create-job">
                  <Button variant="hero">Request this service</Button>
                </Link>
              </div>

              <div className="mt-10">
                <h2 className="text-xl font-semibold mb-4">Available Fundis</h2>

                {fundis.length === 0 ? (
                  <div className="rounded-2xl border bg-card p-6">
                    <p className="text-muted-foreground">
                      No verified Fundis available for this service right now.
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      You can still create a job request and we’ll notify nearby professionals as they come online.
                    </p>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-5">
                    {fundis.map((f) => (
                      <div key={f.id} className="rounded-2xl border bg-card p-6">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="font-semibold">{f.name}</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                              {f.location || "Nearby"} • {f.experienceYears} yrs experience
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold">
                              {f.rating > 0 ? `${f.rating}★` : "New"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {f.reviewCount ? `${f.reviewCount} reviews` : "No reviews yet"}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {(f.skills || []).slice(0, 6).map((s) => (
                            <Badge key={s} variant="secondary">
                              {s}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </SiteLayout>
  );
}

