import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import SiteLayout from "@/components/layout/SiteLayout";
import Markdown from "@/components/content/Markdown";
import { apiClient } from "@/lib/api";

type Post = {
  slug: string;
  title: string;
  excerpt?: string | null;
  content: string;
  cover_image_url?: string | null;
  published_at?: string | null;
};

export default function BlogPost() {
  const { slug = "" } = useParams();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiClient.request(`/blog/${slug}`, { includeAuth: false });
        if (!cancelled) setPost(data.post);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load post");
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
        <div className="max-w-3xl">
          <Link to="/blog" className="text-sm text-muted-foreground hover:text-foreground">
            ← Back to Blog
          </Link>

          {loading ? (
            <div className="mt-6">
              <div className="h-8 w-3/4 bg-muted animate-pulse rounded mb-4" />
              <div className="h-4 w-1/2 bg-muted animate-pulse rounded mb-8" />
              <div className="space-y-3">
                <div className="h-4 bg-muted animate-pulse rounded" />
                <div className="h-4 bg-muted animate-pulse rounded" />
                <div className="h-4 bg-muted animate-pulse rounded" />
              </div>
            </div>
          ) : error ? (
            <p className="text-muted-foreground mt-6">{error}</p>
          ) : post ? (
            <article className="mt-6">
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{post.title}</h1>
              {post.excerpt ? (
                <p className="text-muted-foreground mt-3">{post.excerpt}</p>
              ) : null}
              {post.cover_image_url ? (
                <div className="mt-8 rounded-2xl overflow-hidden border bg-muted">
                  <img
                    src={post.cover_image_url}
                    alt={post.title}
                    className="w-full max-h-[420px] object-cover"
                    loading="lazy"
                  />
                </div>
              ) : null}

              <div className="mt-10">
                <Markdown content={post.content} />
              </div>
            </article>
          ) : null}
        </div>
      </div>
    </SiteLayout>
  );
}

