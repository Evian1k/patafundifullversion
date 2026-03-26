import AdminLayout from "@/components/admin/AdminLayout";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

/**
 * Deprecated page kept to avoid broken imports / lint parse errors.
 * Fundi verification is handled in `FundiVerificationManagement`.
 */
export default function VerificationManagement() {
  return (
    <AdminLayout>
      <div className="p-8 max-w-2xl">
        <h1 className="text-3xl font-bold">Verification</h1>
        <p className="text-muted-foreground mt-2">
          This page has been replaced by the new Fundi Verification system.
        </p>
        <div className="mt-6">
          <Link to="/admin/fundis">
            <Button variant="hero">Go to Fundi Verification</Button>
          </Link>
        </div>
      </div>
    </AdminLayout>
  );
}

