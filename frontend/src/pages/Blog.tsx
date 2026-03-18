import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SiteLayout from "@/components/layout/SiteLayout";
import { apiClient } from "@/lib/api";

type BlogPost = {
  slug: string;
  title: string;
  excerpt?: string | null;
  cover_image_url?: string | null;
  published_at?: string | null;
};

export default function Blog() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiClient.request("/blog", { includeAuth: false });
        if (!cancelled) setPosts(data.posts || []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load blog");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SiteLayout>
      <div className="container mx-auto px-4 py-10 md:py-14">
        <div className="max-w-3xl mb-10">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Blog</h1>
          <p className="text-muted-foreground mt-2">
            Product updates, trust & safety, and tips for customers and Fundis.
          </p>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-2 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl border bg-card p-6">
                <div className="h-5 w-3/4 bg-muted animate-pulse rounded mb-3" />
                <div className="h-4 w-full bg-muted animate-pulse rounded mb-2" />
                <div className="h-4 w-2/3 bg-muted animate-pulse rounded" />
              </div>
            ))}
          </div>
        ) : error ? (
          <p className="text-muted-foreground">{error}</p>
        ) : posts.length === 0 ? (
          <p className="text-muted-foreground">No posts yet.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {posts.map((p) => (
              <Link
                key={p.slug}
                to={`/blog/${p.slug}`}
                className="group rounded-2xl border bg-card hover:bg-accent/30 transition-colors overflow-hidden"
              >
                {p.cover_image_url ? (
                  <div className="h-44 w-full bg-muted overflow-hidden">
                    <img
                      src={p.cover_image_url}
                      alt={p.title}
                      className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform"
                      loading="lazy"
                    />
                  </div>
                ) : null}
                <div className="p-6">
                  <h2 className="text-lg font-semibold group-hover:underline underline-offset-4">
                    {p.title}
                  </h2>
                  {p.excerpt ? (
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{p.excerpt}</p>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </SiteLayout>
  );
}

