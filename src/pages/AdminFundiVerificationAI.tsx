import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  Shield,
  TrendingUp,
  AlertCircle,
  Loader,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FundiProfile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  skills: string[];
  experience: string;
  verification_status: "pending" | "approved" | "rejected";
  ai_score: number | null;
  ai_review: string | null;
  created_at: string;
}

interface AIVerificationResult {
  approved: boolean;
  score: number;
  reasons: string[];
  recommendations: string[];
}

const AdminFundiVerificationAI = () => {
  const navigate = useNavigate();
  const [fundis, setFundis] = useState<FundiProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [autoProcessing, setAutoProcessing] = useState(false);

  useEffect(() => {
    loadFundis();
  }, []);

  const loadFundis = async () => {
    try {
      const { data, error } = await supabase
        .from("fundi_profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFundis((data || []) as FundiProfile[]);
    } catch (error) {
      console.error("Error loading fundis:", error);
      toast.error("Failed to load fundi profiles");
    } finally {
      setLoading(false);
    }
  };

  // AI Verification Logic (Local - no API calls needed)
  const performAIVerification = async (
    fundi: FundiProfile
  ): Promise<AIVerificationResult> => {
    const reasons: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    // Check 1: Has skills listed (20 points)
    if (fundi.skills && fundi.skills.length > 0) {
      score += 20;
      reasons.push(`✓ Has ${fundi.skills.length} skills listed`);
    } else {
      reasons.push("✗ No skills listed");
    }

    // Check 2: Has experience details (15 points)
    if (fundi.experience && fundi.experience.trim().length > 20) {
      score += 15;
      reasons.push("✓ Has detailed experience description");
    } else {
      recommendations.push("Add more detailed experience information");
    }

    // Check 3: Phone number format (10 points)
    if (fundi.phone && /^(\+?254|0)[17][0-9]{8}$/.test(fundi.phone)) {
      score += 10;
      reasons.push("✓ Valid Kenyan phone number");
    } else {
      recommendations.push("Verify phone number is valid");
    }

    // Check 4: Email format (10 points)
    if (fundi.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fundi.email)) {
      score += 10;
      reasons.push("✓ Valid email format");
    }

    // Check 5: Name completeness (15 points)
    if (
      fundi.first_name?.trim().length &&
      fundi.first_name.length > 2 &&
      fundi.last_name?.trim().length &&
      fundi.last_name.length > 2
    ) {
      score += 15;
      reasons.push("✓ Complete name information");
    }

    // Check 6: Profile completeness (20 points)
    const completenessFields = [
      fundi.first_name,
      fundi.last_name,
      fundi.email,
      fundi.phone,
      fundi.experience,
    ];
    const completeness =
      (completenessFields.filter((f) => f && String(f).trim().length > 0)
        .length /
        completenessFields.length) *
      100;

    if (completeness >= 80) {
      score += 20;
      reasons.push(`✓ Profile ${completeness.toFixed(0)}% complete`);
    } else {
      recommendations.push(`Improve profile completeness to ${(100 - completeness).toFixed(0)}%`);
    }

    // Final decision
    const approved = score >= 60;

    if (!approved) {
      recommendations.push("Request updated information from fundi");
    }

    return {
      approved,
      score: Math.min(100, score),
      reasons,
      recommendations,
    };
  };

  const verifyFundi = async (fundi: FundiProfile) => {
    setProcessing(fundi.id);
    try {
      // Perform AI verification
      const result = await performAIVerification(fundi);

      // Update in database
      const { error } = await supabase
        .from("fundi_profiles")
        .update({
          verification_status: result.approved ? "approved" : "rejected",
          ai_score: result.score,
          ai_review: JSON.stringify({
            timestamp: new Date().toISOString(),
            reasons: result.reasons,
            recommendations: result.recommendations,
          }),
        })
        .eq("id", fundi.id);

      if (error) throw error;

      toast.success(
        `Fundi ${result.approved ? "approved" : "rejected"} (Score: ${result.score}/100)`
      );

      // Reload fundis
      loadFundis();
    } catch (error) {
      console.error("Verification error:", error);
      toast.error("Verification failed");
    } finally {
      setProcessing(null);
    }
  };

  const autoApproveAll = async () => {
    if (
      !confirm(
        `Auto-approve ${fundis.filter((f) => f.verification_status === "pending").length} pending fundis?`
      )
    ) {
      return;
    }

    setAutoProcessing(true);
    try {
      const pendingFundis = fundis.filter(
        (f) => f.verification_status === "pending"
      );

      for (const fundi of pendingFundis) {
        await verifyFundi(fundi);
        // Small delay to avoid hammering the database
        await new Promise((r) => setTimeout(r, 500));
      }

      toast.success(`Auto-approved ${pendingFundis.length} fundis`);
    } catch (error) {
      console.error("Auto-approve error:", error);
      toast.error("Auto-approve failed");
    } finally {
      setAutoProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const stats = {
    total: fundis.length,
    pending: fundis.filter((f) => f.verification_status === "pending").length,
    approved: fundis.filter((f) => f.verification_status === "approved").length,
    rejected: fundis.filter((f) => f.verification_status === "rejected").length,
    avgScore:
      fundis.reduce((sum, f) => sum + (f.ai_score || 0), 0) / fundis.length || 0,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back</span>
          </button>

          <span className="text-lg font-display font-bold text-foreground">
            AI Fundi Verification
          </span>

          <Button
            size="sm"
            onClick={autoApproveAll}
            disabled={autoProcessing || stats.pending === 0}
            className="gap-1"
          >
            <Zap className="w-4 h-4" />
            Auto-Approve All
          </Button>
        </div>
      </header>

      <main className="pt-24 pb-12">
        <div className="container mx-auto px-4 max-w-6xl">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            {[
              {
                label: "Total",
                value: stats.total,
                icon: Shield,
                color: "text-blue-500",
              },
              {
                label: "Pending",
                value: stats.pending,
                icon: Clock,
                color: "text-yellow-500",
              },
              {
                label: "Approved",
                value: stats.approved,
                icon: CheckCircle,
                color: "text-green-500",
              },
              {
                label: "Rejected",
                value: stats.rejected,
                icon: XCircle,
                color: "text-red-500",
              },
              {
                label: "Avg Score",
                value: `${stats.avgScore.toFixed(0)}/100`,
                icon: TrendingUp,
                color: "text-purple-500",
              },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-card rounded-xl border border-border p-4"
              >
                <div className="flex items-center gap-3">
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  <div>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <p className="text-lg font-bold text-foreground">
                      {stat.value}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Fundis List */}
          <div className="space-y-4">
            {fundis.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No fundi profiles found</p>
              </div>
            ) : (
              fundis.map((fundi) => (
                <motion.div
                  key={fundi.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-card rounded-xl border border-border p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-lg font-semibold text-foreground">
                          {fundi.first_name} {fundi.last_name}
                        </h3>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            fundi.verification_status === "approved"
                              ? "bg-green-500/20 text-green-700"
                              : fundi.verification_status === "rejected"
                                ? "bg-red-500/20 text-red-700"
                                : "bg-yellow-500/20 text-yellow-700"
                          }`}
                        >
                          {fundi.verification_status.toUpperCase()}
                        </span>
                        {fundi.ai_score !== null && (
                          <span className="ml-auto px-3 py-1 rounded-lg bg-primary/10 text-primary font-medium">
                            Score: {fundi.ai_score.toFixed(0)}/100
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Email</p>
                          <p className="text-sm text-foreground">{fundi.email}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Phone</p>
                          <p className="text-sm text-foreground">{fundi.phone}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Skills</p>
                          <p className="text-sm text-foreground">
                            {fundi.skills?.length || 0} listed
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Registered
                          </p>
                          <p className="text-sm text-foreground">
                            {new Date(fundi.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      {fundi.experience && (
                        <div className="mb-3">
                          <p className="text-xs text-muted-foreground mb-1">
                            Experience
                          </p>
                          <p className="text-sm text-foreground line-clamp-2">
                            {fundi.experience}
                          </p>
                        </div>
                      )}

                      {fundi.ai_review && (
                        <div className="mt-3 p-3 rounded-lg bg-muted/50">
                          {(() => {
                            const review = JSON.parse(fundi.ai_review);
                            return (
                              <div>
                                <p className="text-xs font-semibold text-foreground mb-2">
                                  AI Review:
                                </p>
                                <div className="space-y-1">
                                  {review.reasons?.map((r: string, i: number) => (
                                    <p key={i} className="text-xs text-foreground">
                                      {r}
                                    </p>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>

                    {fundi.verification_status === "pending" && (
                      <Button
                        onClick={() => verifyFundi(fundi)}
                        disabled={processing === fundi.id || autoProcessing}
                        className="gap-1"
                      >
                        {processing === fundi.id ? (
                          <>
                            <Loader className="w-4 h-4 animate-spin" />
                            Verifying...
                          </>
                        ) : (
                          <>
                            <Zap className="w-4 h-4" />
                            Verify Now
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminFundiVerificationAI;
