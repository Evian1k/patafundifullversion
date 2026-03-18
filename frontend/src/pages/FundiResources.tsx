import SiteLayout from "@/components/layout/SiteLayout";
import { Link } from "react-router-dom";

export default function FundiResources() {
  return (
    <SiteLayout>
      <div className="container mx-auto px-4 py-10 md:py-14">
        <div className="max-w-3xl">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Fundi Resources</h1>
          <p className="text-muted-foreground mt-3">
            Guidance for verified professionals using PataFundi.
          </p>

          <div className="mt-10 space-y-5">
            <div className="rounded-2xl border bg-card p-6">
              <h2 className="text-lg font-semibold">Verification tips</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Use clear photos, match your ID details, and keep your profile location accurate.
              </p>
            </div>
            <div className="rounded-2xl border bg-card p-6">
              <h2 className="text-lg font-semibold">Do’s and don’ts</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Avoid off-platform payments and keep communication professional. Repeated cancellations can reduce visibility.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Read the{" "}
                <Link className="underline underline-offset-4" to="/platform-rules">
                  Platform Rules
                </Link>{" "}
                and{" "}
                <Link className="underline underline-offset-4" to="/enforcement">
                  Enforcement Policy
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}

