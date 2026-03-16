import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function FundiPendingApproval() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [email, setEmail] = useState<string>("");
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const [otpRequired, setOtpRequired] = useState(false);
  const [otp, setOtp] = useState("");

  const canSubmitOtp = useMemo(() => otp.trim().length >= 4, [otp]);

  const load = async () => {
    setStatusLoading(true);
    try {
      const userRes = await apiClient.getCurrentUser();
      const user = userRes?.user;
      if (!user) throw new Error("Not authenticated");
      setEmail(user.email || "");

      const s = await apiClient.getFundiApprovalStatus();
      setVerificationStatus(s?.fundi?.verificationStatus ?? null);
      setOtpRequired(Boolean(s?.gates?.otpRequired));

      if (s?.gates?.isApproved && !s?.gates?.otpRequired) {
        navigate("/fundi");
      }
    } catch (err) {
      localStorage.removeItem("auth_token");
      navigate("/auth");
    } finally {
      setStatusLoading(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      navigate("/auth");
      return;
    }

    load();
    const id = window.setInterval(load, 15_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const handleVerifyOtp = async () => {
    try {
      if (!email) throw new Error("Missing email");
      const r = await apiClient.otpVerify(email, otp, "fundi_approval");
      if (r?.token) {
        toast.success("OTP verified. Welcome!");
        navigate("/fundi");
      } else {
        toast.success("OTP verified");
        navigate("/fundi");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "OTP verification failed";
      toast.error(msg);
    }
  };

  const handleResend = async () => {
    try {
      if (!email) throw new Error("Missing email");
      await apiClient.otpResend(email, "fundi_approval");
      toast.success("OTP resent");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to resend OTP";
      toast.error(msg);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const status = (verificationStatus || "pending").toLowerCase();

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-card/80 backdrop-blur-xl border border-border/60 rounded-2xl p-6 shadow-lg space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">Review & Approval</h1>
          <p className="text-muted-foreground">
            Your documents were submitted. Please wait while the system/admin reviews them.
          </p>
        </div>

        <div className="rounded-xl border border-border/60 p-4 bg-secondary/30">
          <div className="text-sm text-muted-foreground">Current status</div>
          <div className="mt-1 text-lg font-semibold text-foreground">
            {status === "approved" ? "Approved" : status === "rejected" ? "Rejected" : "Pending"}
          </div>
          {statusLoading && <div className="mt-2 text-xs text-muted-foreground">Updating…</div>}
        </div>

        {status === "rejected" && (
          <div className="rounded-xl border border-destructive/40 p-4 bg-destructive/10 text-sm text-foreground">
            Your verification was rejected. Please contact support or re-register with correct documents.
            <div className="mt-3">
              <Button variant="outline" onClick={() => navigate("/fundi/register")}>
                Try Again
              </Button>
            </div>
          </div>
        )}

        {otpRequired && status === "approved" && (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Your account is approved. Enter the OTP sent to your email to access your fundi dashboard.
            </div>
            <input
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              inputMode="numeric"
              placeholder="Enter OTP"
              className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
            />
            <div className="flex gap-2">
              <Button disabled={!canSubmitOtp} onClick={handleVerifyOtp} className="flex-1">
                Verify OTP
              </Button>
              <Button variant="outline" onClick={handleResend}>
                Resend
              </Button>
            </div>
          </div>
        )}

        {!otpRequired && status !== "rejected" && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/")}>
              Home
            </Button>
            <Button onClick={load} className="ml-auto">
              Refresh
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

