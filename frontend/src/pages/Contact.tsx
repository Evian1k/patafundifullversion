import SiteLayout from "@/components/layout/SiteLayout";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export default function Contact() {
  const supportEmail = "patafundi6@gmail.com";
  return (
    <SiteLayout>
      <div className="container mx-auto px-4 py-10 md:py-14">
        <div className="max-w-3xl">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Contact Us</h1>
          <p className="text-muted-foreground mt-3">
            We’re here to help customers and Fundis.
          </p>

          <div className="mt-10 grid md:grid-cols-2 gap-6">
            <div className="rounded-2xl border bg-card p-6">
              <h2 className="text-lg font-semibold">Support</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Email:{" "}
                <a className="underline underline-offset-4" href={`mailto:${supportEmail}`}>
                  {supportEmail}
                </a>
              </p>
              <div className="mt-5 flex gap-3">
                <Link to="/contact-support">
                  <Button variant="hero">Contact Support</Button>
                </Link>
                <Link to="/report-problem">
                  <Button variant="outline">Report a Problem</Button>
                </Link>
              </div>
            </div>
            <div className="rounded-2xl border bg-card p-6">
              <h2 className="text-lg font-semibold">Business</h2>
              <p className="text-sm text-muted-foreground mt-2">
                For partnerships and integrations, reach out via Support and select the “Other” category.
              </p>
            </div>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}

