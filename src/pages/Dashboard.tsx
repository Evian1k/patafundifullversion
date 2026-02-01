import { Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  Plus, 
  Clock, 
  CheckCircle, 
  MapPin, 
  Star, 
  MessageSquare,
  LogOut,
  Settings,
  Wrench,
  ChevronRight,
  AlertCircle,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface JobPhoto {
  id: string;
  photo_url: string;
}

interface JobData {
  id: string;
  title: string;
  description: string;
  service_categories: { name: string } | null;
  urgency: string;
  location: string;
  status: string;
  created_at: string;
  updated_at: string;
  job_photos?: JobPhoto[];
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<{ id?: string; user_metadata?: { full_name?: string } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeJobs, setActiveJobs] = useState<JobData[]>([]);
  const [recentJobs, setRecentJobs] = useState<JobData[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (!session?.user) {
        navigate("/auth");
      } else {
        // Fetch jobs when user is available
        fetchUserJobs(session.user.id);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (!session?.user) {
        navigate("/auth");
      } else {
        fetchUserJobs(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Fetch user's jobs from database
  const fetchUserJobs = async (userId: string) => {
    setJobsLoading(true);
    try {
      // Fetch active jobs (pending, matching, accepted, in_progress)
      const { data: active, error: activeError } = await supabase
        .from("jobs")
        .select("*, service_categories(name), job_photos(*)")
        .eq("customer_id", userId)
        .in("status", ["pending", "matching", "accepted", "in_progress"])
        .order("created_at", { ascending: false });

      if (activeError) throw activeError;
      setActiveJobs(active || []);

      // Fetch completed jobs
      const { data: completed, error: completedError } = await supabase
        .from("jobs")
        .select("*, service_categories(name), job_photos(*)")
        .eq("customer_id", userId)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(10);

      if (completedError) throw completedError;
      setRecentJobs(completed || []);
    } catch (error) {
      console.error("Error fetching jobs:", error);
      toast.error("Failed to load jobs");
    } finally {
      setJobsLoading(false);
    }
  };

  // Cancel a job
  const cancelJob = async (jobId: string) => {
    if (!confirm("Are you sure you want to cancel this job?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("jobs")
        .update({ status: "cancelled" })
        .eq("id", jobId)
        .eq("customer_id", user?.id);

      if (error) throw error;

      // Remove from active jobs
      setActiveJobs(activeJobs.filter((job) => job.id !== jobId));
      toast.success("Job cancelled successfully");
    } catch (error) {
      console.error("Error cancelling job:", error);
      toast.error("Failed to cancel job");
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-xl border-b border-border/50 sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
                <Wrench className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-display text-lg font-bold text-foreground">
                Fundi<span className="text-primary">Hub</span>
              </span>
            </Link>

            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => navigate("/admin/verify-fundis")}
                title="AI Fundi Verification"
              >
                <Zap className="w-5 h-5" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => navigate("/settings")}
              >
                <Settings className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleSignOut}>
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Welcome */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-2xl font-display font-bold text-foreground mb-1">
            Hello, {user?.user_metadata?.full_name?.split(" ")[0] || "there"}! 👋
          </h1>
          <p className="text-muted-foreground">What needs fixing today?</p>
        </motion.div>

        {/* Quick Action */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <Link to="/create-job">
            <div className="p-6 rounded-2xl bg-gradient-primary text-primary-foreground shadow-lg hover:shadow-xl transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold mb-1">Create New Job</h2>
                  <p className="text-primary-foreground/80 text-sm">
                    Get matched with verified fundis
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                  <Plus className="w-6 h-6" />
                </div>
              </div>
            </div>
          </Link>
        </motion.div>

        {/* Active Jobs */}
        {jobsLoading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-8"
          >
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          </motion.div>
        ) : activeJobs.length > 0 ? (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-8"
          >
            <h2 className="text-lg font-display font-semibold text-foreground mb-4">
              Active Jobs
            </h2>
            <div className="space-y-3">
              {activeJobs.map((job) => {
                const statusColors: { [key: string]: string } = {
                  pending: "bg-yellow-500/10 text-yellow-600",
                  matching: "bg-blue-500/10 text-blue-600",
                  accepted: "bg-purple-500/10 text-purple-600",
                  in_progress: "bg-accent/10 text-accent",
                };
                const statusLabels: { [key: string]: string } = {
                  pending: "Pending",
                  matching: "Finding Fundis",
                  accepted: "Accepted",
                  in_progress: "In Progress",
                };

                return (
                  <motion.div
                    key={job.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-4 rounded-xl bg-card border border-border/50 shadow-sm hover:shadow-md transition-shadow"
                  >
                    {/* Job Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${
                            statusColors[job.status] || "bg-muted text-muted-foreground"
                          } text-xs font-medium mb-2`}
                        >
                          <Clock className="w-3 h-3" />
                          {statusLabels[job.status] || job.status}
                        </span>
                        <h3 className="font-semibold text-foreground">{job.title}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">{job.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => cancelJob(job.id)}
                          className="p-2 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
                          title="Cancel job"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                    </div>

                    {/* Job Details */}
                    <div className="flex items-center justify-between pt-3 border-t border-border/50 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="w-4 h-4" />
                        <span className="truncate">{job.location}</span>
                      </div>
                      <span className="text-xs font-medium text-primary capitalize">
                        {job.urgency}
                      </span>
                    </div>

                    {/* Photo Preview */}
                    {job.job_photos && job.job_photos.length > 0 && (
                      <div className="mt-3 flex gap-2">
                        {job.job_photos.slice(0, 3).map((photo) => (
                          <img
                            key={photo.id}
                            src={photo.photo_url}
                            alt="Job"
                            className="w-12 h-12 rounded-lg object-cover border border-border"
                          />
                        ))}
                        {job.job_photos.length > 3 && (
                          <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
                            +{job.job_photos.length - 3}
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </motion.section>
        ) : null}

        {/* Recent Jobs */}
        {recentJobs.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h2 className="text-lg font-display font-semibold text-foreground mb-4">
              Completed Jobs
            </h2>
            <div className="space-y-3">
              {recentJobs.map((job) => (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="p-4 rounded-xl bg-card border border-border/50 shadow-sm hover:shadow-md transition-shadow flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-success" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-foreground">{job.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        Completed on {new Date(job.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-primary capitalize">
                    {job.service_categories?.name || job.urgency}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}

        {/* Empty State */}
        {!jobsLoading && activeJobs.length === 0 && recentJobs.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center py-12"
          >
            <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Jobs Yet</h3>
            <p className="text-muted-foreground mb-6">
              Create your first job request to get started with FundiHub
            </p>
            <Link to="/create-job">
              <Button variant="hero">
                <Plus className="w-4 h-4" />
                Create Job Request
              </Button>
            </Link>
          </motion.div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
