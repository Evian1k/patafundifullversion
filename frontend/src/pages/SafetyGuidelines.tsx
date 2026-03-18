import SiteLayout from "@/components/layout/SiteLayout";
import { Link } from "react-router-dom";

export default function SafetyGuidelines() {
  return (
    <SiteLayout>
      <div className="container mx-auto px-4 py-10 md:py-14">
        <div className="max-w-3xl">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Safety Guidelines</h1>
          <p className="text-muted-foreground mt-3">
            Simple steps to stay safe before, during, and after a job.
          </p>

          <div className="mt-10 space-y-6">
            <section className="rounded-2xl border bg-card p-6">
              <h2 className="text-lg font-semibold">Before the job</h2>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground list-disc pl-5">
                <li>Keep communication on-platform whenever possible.</li>
                <li>Never share passwords or one-time codes with anyone.</li>
                <li>Avoid off-platform payments — they remove protections.</li>
              </ul>
            </section>

            <section className="rounded-2xl border bg-card p-6">
              <h2 className="text-lg font-semibold">During the job</h2>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground list-disc pl-5">
                <li>Meet in a well-lit area when possible and keep someone informed.</li>
                <li>Confirm the service details and expected cost before work begins.</li>
                <li>Report any suspicious behavior immediately.</li>
              </ul>
            </section>

            <section className="rounded-2xl border bg-card p-6">
              <h2 className="text-lg font-semibold">After the job</h2>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground list-disc pl-5">
                <li>Confirm completion honestly (OTP where applicable).</li>
                <li>Leave a rating and review to help the community.</li>
                <li>Use{" "}
                  <Link className="underline underline-offset-4" to="/report-problem">
                    Report a Problem
                  </Link>{" "}
                  for fraud, abuse, or payment issues.</li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}

