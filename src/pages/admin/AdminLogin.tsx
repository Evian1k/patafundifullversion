import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Shield, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const handleLogin = async (emailVal: string, passwordVal: string) => {
    setLoading(true);
    setError("");

    try {
      // Check if user exists in admin_accounts table
      const { data: adminUser, error: checkError } = await supabase
        .from("admin_accounts")
        .select("*")
        .eq("email", emailVal)
        .single();

      if (checkError || !adminUser) {
        throw new Error("Admin account not found");
      }

      // Sign in with Supabase auth
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: emailVal,
        password: passwordVal,
      });

      if (signInError) throw signInError;
      if (!data.session) throw new Error("No session created");

      // Verify the user has admin role
      if (adminUser.role !== "super_admin" && adminUser.role !== "support_admin") {
        throw new Error("Insufficient permissions");
      }

      // Set admin session flag
      localStorage.setItem("admin_session", JSON.stringify({
        userId: data.user.id,
        role: adminUser.role,
        email: adminUser.email,
      }));

      toast.success("Welcome back, Admin!");
      navigate("/admin/dashboard");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed";
      setError(msg);
      toast.error(msg);
      setLoading(false);
    }
  };

  // Auto-login on component mount with hardcoded credentials
  useEffect(() => {
    const adminEmail = "emmanuelevian@gmail.com";
    const adminPassword = "neemajoy12k";
    
    handleLogin(adminEmail, adminPassword);
  }, []);

  if (loading) {
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
                  <p className="text-sm text-muted-foreground">Signing in...</p>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary to-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <Card className="p-8 border-2 border-destructive/20">
            <div className="flex flex-col items-center justify-center gap-4 text-center">
              <div className="p-3 bg-destructive/10 rounded-xl">
                <Shield className="w-8 h-8 text-destructive" />
              </div>
              <div>
                <h1 className="text-2xl font-bold mb-2">Login Failed</h1>
                <p className="text-sm text-destructive mb-4">{error}</p>
                <p className="text-xs text-muted-foreground">
                  Please check that the admin_accounts table has been created in Supabase.
                  See: /ADMIN_LOGIN_SETUP.md
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  return null;
}
