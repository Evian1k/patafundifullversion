import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Search,
  MapPin,
  Clock,
  DollarSign,
  Loader2,
  Eye,
  Filter,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import AdminLayout from "@/components/admin/AdminLayout";

interface Job {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  customerId: string;
  customerName: string;
  fundiId: string | null;
  fundiName: string | null;
  estimatedPrice: number;
  finalPrice: number;
  location: string;
  createdAt: string;
  updatedAt: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
  matching: "bg-blue-100 text-blue-800 border-blue-300",
  accepted: "bg-purple-100 text-purple-800 border-purple-300",
  in_progress: "bg-cyan-100 text-cyan-800 border-cyan-300",
  completed: "bg-green-100 text-green-800 border-green-300",
  cancelled: "bg-red-100 text-red-800 border-red-300",
  disputed: "bg-orange-100 text-orange-800 border-orange-300",
};

export default function JobManagement() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 10,
    total: 0,
    pages: 1,
  });

  const fetchJobs = async (page = 1) => {
    setLoading(true);
    try {
      let endpoint = `/admin/jobs?page=${page}&limit=${pagination.limit}`;
      if (searchQuery) {
        endpoint += `&q=${encodeURIComponent(searchQuery)}`;
      }
      if (statusFilter) {
        endpoint += `&status=${statusFilter}`;
      }

      const response = await apiClient.request(endpoint, { includeAuth: true });
      
      if (response && response.success) {
        setJobs(response.jobs || []);
        setPagination(response.pagination || { page, limit: 10, total: 0, pages: 1 });
      } else {
        setJobs([]);
        setPagination({ page, limit: 10, total: 0, pages: 1 });
      }
    } catch (error) {
      console.error("Error fetching jobs:", error);
      setJobs([]);
      setPagination({ page, limit: 10, total: 0, pages: 1 });
      toast.error("Failed to load jobs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs(1);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchJobs(1);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-KE", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };
  return (
    <AdminLayout>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Job Monitoring</h1>
            <p className="text-muted-foreground mt-1">
              View and monitor all jobs on the platform
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Total Jobs</p>
            <p className="text-2xl font-bold">{pagination.total}</p>
          </div>
        </div>

        {/* Filters */}
        <Card className="p-6 space-y-4">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search jobs by title, ID, or location..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border rounded-lg bg-white"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="matching">Matching</option>
                <option value="accepted">Accepted</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="disputed">Disputed</option>
              </select>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Searching..." : "Filter Jobs"}
            </Button>
          </form>
        </Card>

        {/* Jobs List */}
        {loading ? (
          <Card className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading jobs...</p>
          </Card>
        ) : jobs.length === 0 ? (
          <Card className="p-12 text-center">
            <Loader2 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold mb-2">No Jobs Found</h3>
            <p className="text-muted-foreground">
              {searchQuery
                ? "Try adjusting your search criteria"
                : "No jobs available"}
            </p>
          </Card>
        ) : (
          <>
            <div className="grid gap-4">
              {jobs.map((job) => (
                <motion.div
                  key={job.id}
                  whileHover={{ y: -2 }}
                >
                  <Card className="p-6 hover:shadow-md transition">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {job.title}
                          </h3>
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                            {job.description}
                          </p>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-medium border ${
                            STATUS_COLORS[job.status] ||
                            "bg-gray-100 text-gray-800 border-gray-300"
                          }`}
                        >
                          {job.status.replace("_", " ").toUpperCase()}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-4 border-t">
                        <div>
                          <p className="text-xs text-gray-500 font-medium">
                            CATEGORY
                          </p>
                          <p className="text-sm font-semibold text-gray-900 mt-1">
                            {job.category}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-gray-500 font-medium">
                            CUSTOMER
                          </p>
                          <p className="text-sm font-semibold text-gray-900 mt-1">
                            {job.customerName}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-gray-500 font-medium">
                            FUNDI
                          </p>
                          <p className="text-sm font-semibold text-gray-900 mt-1">
                            {job.fundiName || "Unassigned"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-gray-500 font-medium">
                            PRICE
                          </p>
                          <p className="text-sm font-semibold text-green-600 mt-1">
                            {job.finalPrice > 0
                              ? formatCurrency(job.finalPrice)
                              : formatCurrency(job.estimatedPrice)}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-gray-500 font-medium">
                            CREATED
                          </p>
                          <p className="text-sm font-semibold text-gray-900 mt-1">
                            {formatDate(job.createdAt)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2 text-sm text-gray-600">
                        <MapPin className="w-4 h-4" />
                        <span>{job.location}</span>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-sm text-gray-600">
                  Page {pagination.page} of {pagination.pages}
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={() =>
                      fetchJobs(Math.max(1, pagination.page - 1))
                    }
                    disabled={pagination.page === 1 || loading}
                    variant="outline"
                  >
                    Previous
                  </Button>
                  <Button
                    onClick={() =>
                      fetchJobs(
                        Math.min(pagination.pages, pagination.page + 1)
                      )
                    }
                    disabled={pagination.page === pagination.pages || loading}
                    variant="outline"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
