import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Lock, User, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "@/components/ui/input-otp";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const signupSchema = loginSchema.extend({
  name: z.string().min(2, "Name must be at least 2 characters"),
});

const Auth = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">(
    searchParams.get("mode") === "signup" ? "signup" : "login"
  );
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [signupStage, setSignupStage] = useState<"form" | "otp">("form");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const routeAfterAuth = useCallback(async () => {
    const meRes = await apiClient.getCurrentUser();
    const me = meRes && meRes.user ? meRes.user : null;
    if (!me) return navigate("/dashboard");

    if (me.role === "admin" || (me.roles && me.roles.includes("admin"))) return navigate("/admin/dashboard");
    if (me.role === "fundi") return navigate("/fundi");

    if (me.role === "fundi_pending") {
      try {
        const s = await apiClient.getFundiApprovalStatus();
        return navigate(s?.fundi ? "/fundi/pending" : "/fundi/register");
      } catch {
        return navigate("/fundi/register");
      }
    }

    return navigate("/dashboard");
  }, [navigate]);

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('auth_token');
    const explicitMode = searchParams.get('mode');
    // If the URL explicitly requested a mode (signup/login), respect it and don't auto-redirect
    if (token && !explicitMode) {
      (async () => {
        try {
          await routeAfterAuth();
        } catch (err) {
          navigate('/dashboard');
        }
      })();
    }
  }, [navigate, routeAfterAuth]);

  // Persist OTP session so refresh doesn't strand the user
  useEffect(() => {
    if (mode !== "signup") return;
    const savedEmail = localStorage.getItem("pending_otp_email");
    const savedPurpose = localStorage.getItem("pending_otp_purpose");
    if (savedEmail && savedPurpose === "register") {
      setPendingEmail(savedEmail);
      setSignupStage("otp");
    }
  }, [mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      const schema = mode === "signup" ? signupSchema : loginSchema;
      const validatedData = schema.parse(formData);

      if (mode === "signup") {
        const reg = await apiClient.register(
          validatedData.email,
          validatedData.password,
          formData.name
        );
        setPendingEmail(validatedData.email);
        setSignupStage("otp");
        setResendCooldown(30);
        localStorage.setItem("pending_otp_email", validatedData.email);
        localStorage.setItem("pending_otp_purpose", "register");
        toast.success(reg?.message || "OTP sent. Check your email.");
      } else {
        await apiClient.login(validatedData.email, validatedData.password);
        toast.success("Welcome back!");
        try {
          await routeAfterAuth();
        } catch (err) {
          navigate('/dashboard');
        }
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0].toString()] = err.message;
          }
        });
        setErrors(fieldErrors);
      } else {
        const msg = error instanceof Error ? error.message : "Authentication failed";
        // If the account exists but isn't verified, guide user to OTP screen (common after refresh)
        if (typeof msg === "string" && msg.toLowerCase().includes("not verified")) {
          const email = formData.email;
          if (email) {
            setMode("signup");
            setPendingEmail(email);
            setSignupStage("otp");
            setOtpCode("");
            setResendCooldown(0);
            localStorage.setItem("pending_otp_email", email);
            localStorage.setItem("pending_otp_purpose", "register");
            toast.error(msg);
            return;
          }
        }
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (signupStage !== "otp") return;
    if (resendCooldown <= 0) return;
    const t = setInterval(() => {
      setResendCooldown((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [signupStage, resendCooldown]);

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingEmail) return;
    setLoading(true);
    try {
      await apiClient.otpVerify(pendingEmail, otpCode, "register");
      localStorage.removeItem("pending_otp_email");
      localStorage.removeItem("pending_otp_purpose");
      toast.success("Verified! Welcome to FundiHub.");
      await routeAfterAuth();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "OTP verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Back link */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>

        <div className="bg-card rounded-2xl shadow-xl border border-border/50 p-8">
          {/* Logo */}
          <Link to="/" className="flex items-center justify-center mb-8">
            <img src="/patafundi-logo.png" alt="PataFundi" className="h-12 w-auto" loading="eager" />
          </Link>

          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-display font-bold text-foreground mb-2">
              {mode === "login" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {mode === "login"
                ? "Sign in to access your account"
                : "Get started with FundiHub today"}
            </p>
          </div>

          {/* Form */}
          {mode === "signup" && signupStage === "otp" ? (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Enter the 6-digit code sent to <span className="font-medium text-foreground">{pendingEmail}</span>.
              </div>

              <div className="flex justify-center">
                <InputOTP maxLength={6} value={otpCode} onChange={(v) => setOtpCode(v)}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <Button
                type="submit"
                variant="hero"
                size="lg"
                className="w-full"
                disabled={loading || otpCode.trim().length !== 6}
              >
                {loading ? "Verifying..." : "Verify OTP"}
              </Button>

                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  disabled={loading || !pendingEmail || resendCooldown > 0}
                  onClick={async () => {
                    if (!pendingEmail) return;
                    try {
                      await apiClient.otpResend(pendingEmail, "register");
                      setResendCooldown(30);
                      localStorage.setItem("pending_otp_email", pendingEmail);
                      localStorage.setItem("pending_otp_purpose", "register");
                      toast.success("OTP resent. Check your email.");
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Failed to resend OTP");
                    }
                  }}
                >
                  {resendCooldown > 0 ? `Resend OTP (${resendCooldown}s)` : "Resend OTP"}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setSignupStage("form");
                    setOtpCode("");
                    setResendCooldown(0);
                    localStorage.removeItem("pending_otp_email");
                    localStorage.removeItem("pending_otp_purpose");
                  }}
                  disabled={loading}
                >
                  Back
                </Button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full h-12 pl-10 pr-4 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                  />
                </div>
                {errors.name && (
                  <p className="text-sm text-destructive mt-1">{errors.name}</p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full h-12 pl-10 pr-4 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                />
              </div>
              {errors.email && (
                <p className="text-sm text-destructive mt-1">{errors.email}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full h-12 pl-10 pr-12 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-destructive mt-1">{errors.password}</p>
              )}
            </div>

            <Button
              type="submit"
              variant="hero"
              size="lg"
              className="w-full"
              disabled={loading}
            >
              {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
            </Button>

            {mode === "signup" && (
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full"
                disabled={loading}
                onClick={() => {
                  try {
                    localStorage.setItem(
                      "fundi_prefill",
                      JSON.stringify({
                        fullName: formData.name || "",
                        email: formData.email || "",
                      })
                    );
                  } catch {
                    // ignore
                  }
                  navigate("/fundi/register");
                }}
              >
                Register as Fundi (verification required)
              </Button>
            )}
            </form>
          )}

          {/* Toggle mode */}
          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">
              {mode === "login" ? "Don't have an account? " : "Already have an account? "}
            </span>
            <button
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="text-primary font-semibold hover:underline"
            >
              {mode === "login" ? "Sign up" : "Sign in"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;
