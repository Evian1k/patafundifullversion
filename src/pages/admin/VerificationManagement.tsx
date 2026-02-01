import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Search, Check, X, AlertCircle, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FundiApplication {
  id: string;
  user_id: string;
  id_number: string | null;
  id_photo_url: string | null;
  selfie_url: string | null;
  verification_status: "pending" | "verified" | "rejected" | null;
  created_at: string;
  bio: string | null;
  skills: string[];
}

export default function VerificationManagement() {
  const [applications, setApplications] = useState<FundiApplication[]>([]);
  const [filteredApps, setFilteredApps] = useState<FundiApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedApp, setSelectedApp] = useState<FundiApplication | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    fetchApplications();
  }, []);

  useEffect(() => {
    const filtered = applications.filter(
      (app) =>
        app.id_number?.includes(searchTerm) ||
        app.id.includes(searchTerm) ||
        app.verification_status?.includes(searchTerm)
    );
    setFilteredApps(filtered);
  }, [searchTerm, applications]);

  const fetchApplications = async () => {
    try {
      const { data, error } = await supabase
        .from("fundi_profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setApplications(data || []);
    } catch (error) {
      console.error("Error fetching applications:", error);
      toast.error("Failed to load applications");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (app: FundiApplication) => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("fundi_profiles")
        .update({ verification_status: "verified" })
        .eq("id", app.id);

      if (error) throw error;
      toast.success("Application approved!");
      setSelectedApp(null);
      fetchApplications();
    } catch (error) {
      toast.error("Failed to approve application");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (app: FundiApplication) => {
    if (!rejectReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("fundi_profiles")
        .update({
          verification_status: "rejected",
        })
        .eq("id", app.id);

      if (error) throw error;

      toast.success("Application rejected with reason provided");
      setSelectedApp(null);
      setRejectReason("");
      fetchApplications();
    } catch (error) {
      toast.error("Failed to reject application");
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case "verified":
        return "text-green-500";
      case "rejected":
        return "text-red-500";
      case "pending":
        return "text-yellow-500";
      default:
        return "text-muted-foreground";
    }
  };

  const getStatusBg = (status: string | null) => {
    switch (status) {
      case "verified":
        return "bg-green-500/10";
      case "rejected":
        return "bg-red-500/10";
      case "pending":
        return "bg-yellow-500/10";
      default:
        return "bg-slate-500/10";
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Fundi Verification</h1>
        <p className="text-muted-foreground">Review and approve fundi applications</p>
      </div>

      {/* Search */}
      <Card className="p-4 border-2">
        <div className="relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by ID number, user ID, or status..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </Card>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Applications List */}
        <div className="lg:col-span-2 space-y-3 max-h-[calc(100vh-300px)] overflow-auto">
          {filteredApps.length === 0 ? (
            <Card className="p-8 text-center border-2">
              <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">No applications found</p>
            </Card>
          ) : (
            filteredApps.map((app) => (
              <motion.div
                key={app.id}
                whileHover={{ x: 4 }}
                onClick={() => setSelectedApp(app)}
              >
                <Card
                  className={`p-4 border-2 cursor-pointer transition ${
                    selectedApp?.id === app.id
                      ? "border-primary bg-primary/5"
                      : "hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <code className="text-sm font-mono text-primary">
                          {app.id_number || "No ID"}
                        </code>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusBg(
                            app.verification_status
                          )} ${getStatusColor(app.verification_status)}`}
                        >
                          {app.verification_status || "unknown"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        ID: {app.user_id.slice(0, 8)}...
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(app.created_at).toLocaleDateString()}
                      </p>
                      {app.skills && app.skills.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {app.skills.slice(0, 3).map((skill, idx) => (
                            <span key={idx} className="text-xs bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded">
                              {skill}
                            </span>
                          ))}
                          {app.skills.length > 3 && (
                            <span className="text-xs text-muted-foreground">+{app.skills.length - 3} more</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))
          )}
        </div>

        {/* Detail Panel */}
        {selectedApp && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            <Card className="p-6 border-2 space-y-4">
              {/* ID Photo */}
              <div>
                <p className="text-sm font-semibold mb-2">ID Photo</p>
                {selectedApp.id_photo_url ? (
                  <img
                    src={selectedApp.id_photo_url}
                    alt="ID"
                    className="w-full h-48 object-cover rounded-lg border border-border"
                  />
                ) : (
                  <div className="w-full h-48 bg-slate-200 dark:bg-slate-700 rounded-lg flex items-center justify-center text-muted-foreground">
                    No image uploaded
                  </div>
                )}
              </div>

              {/* Selfie Photo */}
              <div>
                <p className="text-sm font-semibold mb-2">Selfie Photo</p>
                {selectedApp.selfie_url ? (
                  <img
                    src={selectedApp.selfie_url}
                    alt="Selfie"
                    className="w-full h-48 object-cover rounded-lg border border-border"
                  />
                ) : (
                  <div className="w-full h-48 bg-slate-200 dark:bg-slate-700 rounded-lg flex items-center justify-center text-muted-foreground">
                    No selfie uploaded
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="space-y-2">
                <p className="text-sm">
                  <span className="font-semibold">ID Number:</span> {selectedApp.id_number || "Not provided"}
                </p>
                <p className="text-sm">
                  <span className="font-semibold">Status:</span>{" "}
                  <span className={getStatusColor(selectedApp.verification_status)}>
                    {selectedApp.verification_status || "unknown"}
                  </span>
                </p>
                {selectedApp.bio && (
                  <p className="text-sm">
                    <span className="font-semibold">Bio:</span> {selectedApp.bio}
                  </p>
                )}
                <p className="text-sm text-muted-foreground">
                  Submitted: {new Date(selectedApp.created_at).toLocaleString()}
                </p>
              </div>

              {/* Actions */}
              {selectedApp.verification_status === "pending" && (
                <div className="space-y-3 pt-4 border-t border-border">
                  <Button
                    onClick={() => handleApprove(selectedApp)}
                    disabled={actionLoading}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Approve (Verify)
                  </Button>

                  <div>
                    <Input
                      placeholder="Rejection reason..."
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      className="mb-2"
                    />
                    <Button
                      onClick={() => handleReject(selectedApp)}
                      disabled={actionLoading || !rejectReason.trim()}
                      variant="destructive"
                      className="w-full"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}
