import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Shield, Loader2, Mail, Lock, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AdminAccount {
  id: string;
  user_id: string;
  email: string;
  role: 'super_admin' | 'support_admin';
  is_active: boolean;
}

export default function AdminLogin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // Check if already logged in
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          // Check if user is admin
          const { data: adminAccount, error: adminError } = await supabase
            .from("admin_accounts")
            .select("*")
            .eq("user_id", session.user.id)
            .eq("is_active", true)
            .maybeSingle();

          if (!adminError && adminAccount) {
            const typedAdmin = adminAccount as unknown as AdminAccount;
            localStorage.setItem("admin_session", JSON.stringify({
              userId: session.user.id,
              role: typedAdmin.role,
              email: typedAdmin.email,
            }));
            navigate("/admin/dashboard");
            return;
          }
        }
      } catch (err) {
        console.error("Session check error:", err);
      } finally {
        setCheckingSession(false);
      }
    };

    checkSession();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Sign in with Supabase auth
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;
      if (!authData.session) throw new Error("No session created");

      // Check if user has admin access
      const { data: adminAccount, error: adminError } = await supabase
        .from("admin_accounts")
        .select("*")
        .eq("user_id", authData.user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (adminError) {
        console.error("Admin check error:", adminError);
        throw new Error("Failed to verify admin status");
      }

      if (!adminAccount) {
        // Sign out the user since they're not an admin
        await supabase.auth.signOut();
        throw new Error("Access denied. This account is not authorized for admin access.");
      }

      const typedAdmin = adminAccount as unknown as AdminAccount;

      // Verify the user has admin role
      if (typedAdmin.role !== "super_admin" && typedAdmin.role !== "support_admin") {
        await supabase.auth.signOut();
        throw new Error("Insufficient permissions");
      }

      // Set admin session flag
      localStorage.setItem("admin_session", JSON.stringify({
        userId: authData.user.id,
        role: typedAdmin.role,
        email: typedAdmin.email,
      }));

      toast.success("Welcome back, Admin!");
      navigate("/admin/dashboard");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary to-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <Card className="p-8 border-2 border-primary/20">
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="p-3 bg-gradient-to-br from-primary to-orange-600 rounded-xl animate-pulse">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <div className="text-center">
                <h1 className="text-2xl font-bold mb-2">Admin Panel</h1>
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <p className="text-sm text-muted-foreground">Checking session...</p>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <Card className="p-8 border-2 border-primary/20 bg-slate-800/50 backdrop-blur">
          {/* Header */}
          <div className="flex flex-col items-center mb-8">
            <div className="p-4 bg-gradient-to-br from-primary to-orange-600 rounded-2xl mb-4">
              <Shield className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Admin Access</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Authorized personnel only
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-lg flex items-start gap-3"
            >
              <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </motion.div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-slate-700/50 border-slate-600 text-white"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-white">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 bg-slate-700/50 border-slate-600 text-white"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full bg-gradient-to-r from-primary to-orange-600 hover:from-primary/90 hover:to-orange-600/90"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4 mr-2" />
                  Sign In
                </>
              )}
            </Button>
          </form>

          {/* Security Notice */}
          <div className="mt-6 pt-6 border-t border-slate-700">
            <p className="text-xs text-center text-muted-foreground">
              This is a restricted area. Unauthorized access attempts are logged and monitored.
            </p>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
