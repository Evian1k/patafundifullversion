import SiteLayout from "@/components/layout/SiteLayout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function TrustSafety() {
  return (
    <SiteLayout>
      <div className="container mx-auto px-4 py-10 md:py-14">
        <div className="max-w-3xl">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Trust & Safety</h1>
          <p className="text-muted-foreground mt-3">
            Trust is the product. We design PataFundi to reduce fraud and keep users safe.
          </p>

          <div className="mt-10 grid gap-5">
            <div className="rounded-2xl border bg-card p-6">
              <h2 className="text-lg font-semibold">Verification</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Fundis submit identity documents and verification evidence. Suspicious submissions can be flagged for review.
              </p>
            </div>
            <div className="rounded-2xl border bg-card p-6">
              <h2 className="text-lg font-semibold">Location & job signals</h2>
              <p className="text-sm text-muted-foreground mt-2">
                GPS and job history help match customers to nearby, reliable professionals and detect anomalies.
              </p>
            </div>
            <div className="rounded-2xl border bg-card p-6">
              <h2 className="text-lg font-semibold">Payment protection</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Platform payments are required. Off-platform payments increase risk and can lead to suspension.
              </p>
            </div>
            <div className="rounded-2xl border bg-card p-6">
              <h2 className="text-lg font-semibold">Enforcement</h2>
              <p className="text-sm text-muted-foreground mt-2">
                We use a warning → restriction → suspension → ban model based on severity and recurrence.
              </p>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link to="/report-problem">
              <Button variant="hero">Report a Problem</Button>
            </Link>
            <Link to="/platform-rules">
              <Button variant="outline">Platform Rules</Button>
            </Link>
            <Link to="/enforcement">
              <Button variant="outline">Enforcement Policy</Button>
            </Link>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}

