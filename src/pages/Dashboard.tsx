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
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (!session?.user) {
        navigate("/auth");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (!session?.user) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

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

  // Mock data for demonstration
  const activeJobs = [
    {
      id: "1",
      service: "Plumbing",
      description: "Leaky faucet in kitchen",
      status: "in_progress",
      fundi: {
        name: "John Mwangi",
        rating: 4.9,
        eta: "15 min",
      },
    },
  ];

  const recentJobs = [
    {
      id: "2",
      service: "Electrical",
      description: "Socket installation",
      status: "completed",
      date: "Jan 28, 2026",
      amount: "KES 2,500",
    },
    {
      id: "3",
      service: "Cleaning",
      description: "Deep house cleaning",
      status: "completed",
      date: "Jan 25, 2026",
      amount: "KES 4,000",
    },
  ];

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
              <Button variant="ghost" size="icon">
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
        {activeJobs.length > 0 && (
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
              {activeJobs.map((job) => (
                <div
                  key={job.id}
                  className="p-4 rounded-xl bg-card border border-border/50 shadow-sm"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/10 text-accent text-xs font-medium mb-2">
                        <Clock className="w-3 h-3" />
                        In Progress
                      </span>
                      <h3 className="font-semibold text-foreground">{job.service}</h3>
                      <p className="text-sm text-muted-foreground">{job.description}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>

                  {job.fundi && (
                    <div className="flex items-center justify-between pt-3 border-t border-border/50">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-semibold text-muted-foreground">
                          {job.fundi.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-foreground text-sm">{job.fundi.name}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Star className="w-3 h-3 text-warning fill-warning" />
                            {job.fundi.rating}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-accent font-medium flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {job.fundi.eta}
                        </span>
                        <Button size="icon" variant="ghost">
                          <MessageSquare className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.section>
        )}

        {/* Recent Jobs */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-lg font-display font-semibold text-foreground mb-4">
            Recent Jobs
          </h2>
          <div className="space-y-3">
            {recentJobs.map((job) => (
              <div
                key={job.id}
                className="p-4 rounded-xl bg-card border border-border/50 shadow-sm flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground">{job.service}</h3>
                    <p className="text-sm text-muted-foreground">{job.date}</p>
                  </div>
                </div>
                <span className="font-semibold text-foreground">{job.amount}</span>
              </div>
            ))}
          </div>
        </motion.section>
      </main>
    </div>
  );
};

export default Dashboard;
