import SiteLayout from "@/components/layout/SiteLayout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function HowItWorks() {
  return (
    <SiteLayout>
      <div className="container mx-auto px-4 py-10 md:py-14">
        <div className="max-w-3xl">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">How It Works</h1>
          <p className="text-muted-foreground mt-3">
            A simple flow designed for speed, safety, and accountability.
          </p>

          <div className="mt-10 grid gap-5">
            <div className="rounded-2xl border bg-card p-6">
              <div className="text-sm font-semibold">1) Request a service</div>
              <p className="text-sm text-muted-foreground mt-2">
                Describe the issue, choose a category, and add your location. The more detail you provide, the faster matching becomes.
              </p>
            </div>
            <div className="rounded-2xl border bg-card p-6">
              <div className="text-sm font-semibold">2) Match with verified Fundis</div>
              <p className="text-sm text-muted-foreground mt-2">
                Fundis go through identity verification and platform checks. You can review their profile signals (experience, location, ratings).
              </p>
            </div>
            <div className="rounded-2xl border bg-card p-6">
              <div className="text-sm font-semibold">3) Complete the job safely</div>
              <p className="text-sm text-muted-foreground mt-2">
                Communicate through the platform, avoid off-platform payments, and confirm completion honestly.
              </p>
            </div>
            <div className="rounded-2xl border bg-card p-6">
              <div className="text-sm font-semibold">4) Rate and review</div>
              <p className="text-sm text-muted-foreground mt-2">
                Ratings and reviews impact visibility and trust. Repeated abuse leads to enforcement actions.
              </p>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link to="/create-job">
              <Button variant="hero">Create a Job</Button>
            </Link>
            <Link to="/platform-rules">
              <Button variant="outline">Platform Rules</Button>
            </Link>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}

