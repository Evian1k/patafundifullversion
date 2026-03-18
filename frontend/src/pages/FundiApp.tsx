import SiteLayout from "@/components/layout/SiteLayout";
import { Link } from "react-router-dom";

export default function FundiApp() {
  return (
    <SiteLayout>
      <div className="container mx-auto px-4 py-10 md:py-14">
        <div className="max-w-3xl">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Fundi App</h1>
          <p className="text-muted-foreground mt-3">
            The Fundi dashboard is available inside the PataFundi web app.
          </p>

          <div className="mt-10 rounded-2xl border bg-card p-6">
            <p className="text-sm text-muted-foreground">
              If you’re a verified Fundi, sign in and visit your Fundi dashboard. If you are not yet verified, start here:
            </p>
            <div className="mt-4">
              <Link to="/fundi/register" className="underline underline-offset-4">
                Become a Fundi
              </Link>
            </div>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}

