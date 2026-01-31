import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Search, Filter, AlertCircle, Loader2, MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Job {
  id: string;
  title: string;
  description: string;
  status: string;
  customer_id: string;
  fundi_id: string | null;
  location: string;
  latitude: number | null;
  longitude: number | null;
  estimated_price: number | null;
  final_price: number | null;
  created_at: string;
  completed_at: string | null;
}

export default function JobManagement() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    let filtered = jobs;

    if (statusFilter !== "all") {
      filtered = filtered.filter((job) => job.status === statusFilter);
    }

    if (searchTerm) {
      filtered = filtered.filter(
        (job) =>
          job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          job.id.includes(searchTerm) ||
          job.location.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredJobs(filtered);
  }, [searchTerm, statusFilter, jobs]);

  const fetchJobs = async () => {
    try {
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error("Error fetching jobs:", error);
      toast.error("Failed to load jobs");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      const { error } = await supabase
        .from("jobs")
        .update({ status: "cancelled" })
        .eq("id", jobId);

      if (error) throw error;
      toast.success("Job cancelled");
      fetchJobs();
    } catch (error) {
      toast.error("Failed to cancel job");
    }
  };

  const handlePauseJob = async (jobId: string) => {
    try {
      const { error } = await supabase
        .from("jobs")
        .update({ status: "paused" })
        .eq("id", jobId);

      if (error) throw error;
      toast.success("Job paused");
      fetchJobs();
    } catch (error) {
      toast.error("Failed to pause job");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "text-green-500";
      case "cancelled":
        return "text-red-500";
      case "assigned":
        return "text-blue-500";
      case "pending":
        return "text-yellow-500";
      case "paused":
        return "text-orange-500";
      default:
        return "text-muted-foreground";
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500/10";
      case "cancelled":
        return "bg-red-500/10";
      case "assigned":
        return "bg-blue-500/10";
      case "pending":
        return "bg-yellow-500/10";
      case "paused":
        return "bg-orange-500/10";
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
        <h1 className="text-3xl font-bold mb-2">Job Management</h1>
        <p className="text-muted-foreground">Monitor and manage all jobs</p>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 border-2">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search jobs, location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </Card>

        <Card className="p-4 border-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
            </SelectContent>
          </Select>
        </Card>

        <Card className="p-4 border-2 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {filteredJobs.length} jobs
          </span>
          <Filter className="w-4 h-4 text-muted-foreground" />
        </Card>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Jobs List */}
        <div className="lg:col-span-2 space-y-3 max-h-[calc(100vh-300px)] overflow-auto">
          {filteredJobs.length === 0 ? (
            <Card className="p-8 text-center border-2">
              <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">No jobs found</p>
            </Card>
          ) : (
            filteredJobs.map((job) => (
              <motion.div
                key={job.id}
                whileHover={{ x: 4 }}
                onClick={() => setSelectedJob(job)}
              >
                <Card
                  className={`p-4 border-2 cursor-pointer transition ${
                    selectedJob?.id === job.id
                      ? "border-primary bg-primary/5"
                      : "hover:border-primary/40"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold flex-1">{job.title}</h3>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${getStatusBg(
                          job.status
                        )} ${getStatusColor(job.status)}`}
                      >
                        {job.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {job.description}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3" />
                      {job.location}
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Est: KES {job.estimated_price}</span>
                      {job.final_price && <span>Final: KES {job.final_price}</span>}
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))
          )}
        </div>

        {/* Detail Panel */}
        {selectedJob && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            <Card className="p-6 border-2 space-y-4">
              {/* Title & Status */}
              <div>
                <h3 className="text-lg font-semibold mb-2">{selectedJob.title}</h3>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusBg(
                    selectedJob.status
                  )} ${getStatusColor(selectedJob.status)}`}
                >
                  {selectedJob.status}
                </span>
              </div>

              {/* Description */}
              <div>
                <p className="text-sm font-semibold mb-2">Description</p>
                <p className="text-sm text-muted-foreground">{selectedJob.description}</p>
              </div>

              {/* Location */}
              <div>
                <p className="text-sm font-semibold mb-2">Location</p>
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  {selectedJob.location}
                </p>
                {selectedJob.latitude && selectedJob.longitude && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedJob.latitude}, {selectedJob.longitude}
                  </p>
                )}
              </div>

              {/* Pricing */}
              <div className="space-y-2">
                <p className="text-sm font-semibold">Pricing</p>
                <div className="text-sm space-y-1">
                  <p>Estimated: <span className="font-mono">KES {selectedJob.estimated_price}</span></p>
                  {selectedJob.final_price && (
                    <p>Final: <span className="font-mono">KES {selectedJob.final_price}</span></p>
                  )}
                </div>
              </div>

              {/* Dates */}
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Created: {new Date(selectedJob.created_at).toLocaleString()}</p>
                {selectedJob.completed_at && (
                  <p>Completed: {new Date(selectedJob.completed_at).toLocaleString()}</p>
                )}
              </div>

              {/* Actions */}
              {selectedJob.status !== "completed" && selectedJob.status !== "cancelled" && (
                <div className="pt-4 border-t border-border space-y-2">
                  <Button
                    onClick={() => handlePauseJob(selectedJob.id)}
                    variant="outline"
                    className="w-full"
                  >
                    Pause Job
                  </Button>
                  <Button
                    onClick={() => handleCancelJob(selectedJob.id)}
                    variant="destructive"
                    className="w-full"
                  >
                    Cancel Job
                  </Button>
                </div>
              )}
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}
