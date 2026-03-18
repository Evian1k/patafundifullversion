import SiteLayout from "@/components/layout/SiteLayout";
import { Button } from "@/components/ui/button";

export default function Press() {
  return (
    <SiteLayout>
      <div className="container mx-auto px-4 py-10 md:py-14">
        <div className="max-w-3xl">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Press</h1>
          <p className="text-muted-foreground mt-3">
            Press resources for PataFundi. For media inquiries, contact support.
          </p>

          <div className="mt-10 grid md:grid-cols-2 gap-6">
            <div className="rounded-2xl border bg-card p-6">
              <h2 className="text-lg font-semibold">Brand assets</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Use the official logo and icon when referencing PataFundi.
              </p>
              <div className="mt-4 flex items-center gap-3">
                <img src="/patafundi-icon.png" alt="PataFundi icon" className="h-12 w-12 rounded-xl ring-1 ring-black/5 bg-white" />
                <img src="/patafundi-wordmark.png" alt="PataFundi logo" className="h-10 w-auto" />
              </div>
              <div className="mt-5 flex gap-3">
                <a href="/patafundi-icon.png" download>
                  <Button variant="outline" size="sm">Download icon</Button>
                </a>
                <a href="/patafundi-wordmark.png" download>
                  <Button variant="outline" size="sm">Download logo</Button>
                </a>
              </div>
            </div>
            <div className="rounded-2xl border bg-card p-6">
              <h2 className="text-lg font-semibold">Product summary</h2>
              <p className="text-sm text-muted-foreground mt-2">
                PataFundi connects customers with verified local professionals for reliable services — with platform rules, payment protection, and accountability.
              </p>
            </div>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}

