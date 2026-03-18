import SiteLayout from "@/components/layout/SiteLayout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function About() {
  return (
    <SiteLayout>
      <div className="container mx-auto px-4 py-10 md:py-14">
        <div className="max-w-3xl">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">About PataFundi</h1>
          <p className="text-muted-foreground mt-3">
            PataFundi is built to make local services safer, faster, and more reliable — for customers and for professionals.
          </p>

          <div className="mt-10 space-y-8">
            <section className="rounded-2xl border bg-card p-6">
              <h2 className="text-lg font-semibold">Mission</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Connect people to verified local professionals and protect both sides with clear rules, platform payments, and accountability.
              </p>
            </section>

            <section className="rounded-2xl border bg-card p-6">
              <h2 className="text-lg font-semibold">Vision</h2>
              <p className="text-sm text-muted-foreground mt-2">
                A trusted marketplace where quality work is rewarded and customers get peace of mind — every time.
              </p>
            </section>

            <section className="rounded-2xl border bg-card p-6">
              <h2 className="text-lg font-semibold">How the platform works</h2>
              <ol className="mt-3 space-y-2 text-sm text-muted-foreground list-decimal pl-5">
                <li>Customer creates a job request with location and details.</li>
                <li>Verified Fundis nearby receive the job and can accept based on availability.</li>
                <li>Work is completed and confirmed by the customer (including OTP where applicable).</li>
                <li>Payments are handled through the platform to prevent fraud and protect both sides.</li>
                <li>Ratings and reviews help maintain quality and trust.</li>
              </ol>
            </section>
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link to="/how-it-works">
              <Button variant="outline">How It Works</Button>
            </Link>
            <Link to="/trust-safety">
              <Button variant="outline">Trust & Safety</Button>
            </Link>
            <Link to="/contact">
              <Button variant="hero">Contact Us</Button>
            </Link>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}

