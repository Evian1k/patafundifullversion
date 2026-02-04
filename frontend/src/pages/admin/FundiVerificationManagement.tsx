import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Search, MapPin, FileText, CheckCircle, XCircle, AlertCircle, Loader2, Eye } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import FundiVerificationModal from "./FundiVerificationModal";

interface Fundi {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  idNumber: string;
  idPhotoUrl: string;
  selfieUrl: string;
  verificationStatus: string;
  skills: string[];
  createdAt: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export default function FundiVerificationManagement() {
  const navigate = useNavigate();
  const [fundis, setFundis] = useState<Fundi[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 10,
    total: 0,
    pages: 1,
  });
  const [selectedFundi, setSelectedFundi] = useState<Fundi | null>(null);
  const [showModal, setShowModal] = useState(false);

  const fetchFundis = async (page = 1) => {
    setLoading(true);
    try {
      let endpoint = `/admin/search-fundis?page=${page}&limit=${pagination.limit}`;
      if (searchQuery) endpoint += `&q=${encodeURIComponent(searchQuery)}`;
      if (statusFilter) endpoint += `&status=${statusFilter}`;

      const response = await apiClient.request(endpoint, { includeAuth: true });
      setFundis(response.fundis || []);
      setPagination(response.pagination || { page, limit: 10, total: 0, pages: 1 });
    } catch (error) {
      console.error("Error fetching fundis:", error);
      toast.error("Failed to load fundis");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFundis(1);
  }, [statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchFundis(1);
  };

  const handleOpenModal = async (fundi: Fundi) => {
    try {
      const response = await apiClient.request(`/admin/fundis/${fundi.id}`, { includeAuth: true });
      setSelectedFundi(response.fundi);
      setShowModal(true);
    } catch (error) {
      console.error("Error loading fundi details:", error);
      toast.error("Failed to load fundi details");
    }
  };

  const handleRefresh = () => {
    fetchFundis(pagination.page);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "approved":
        return "bg-green-100 text-green-800 border-green-300";
      case "rejected":
        return "bg-red-100 text-red-800 border-red-300";
      case "suspended":
        return "bg-orange-100 text-orange-800 border-orange-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <AlertCircle className="w-4 h-4" />;
      case "approved":
        return <CheckCircle className="w-4 h-4" />;
      case "rejected":
        return <XCircle className="w-4 h-4" />;
      case "suspended":
        return <AlertCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  if (!loading && fundis.length === 0 && !searchQuery) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Fundi Verification</h1>
            <p className="text-muted-foreground">Review and manage fundi registrations</p>
          </div>
          <Button onClick={handleRefresh} className="gap-2">
            Refresh
          </Button>
        </div>

        <Card className="p-12 text-center">
          <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
          <h3 className="text-lg font-semibold mb-2">No {statusFilter} Fundis</h3>
          <p className="text-muted-foreground">All fundis have been processed!</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Fundi Verification</h1>
          <p className="text-muted-foreground">Review and manage fundi registrations</p>
        </div>
        <Button onClick={handleRefresh} className="gap-2">
          <Loader2 className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-6">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, ID, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border rounded-lg bg-white"
            >
              <option value="pending">Pending Verification</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="suspended">Suspended</option>
              <option value="">All Statuses</option>
            </select>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Searching..." : "Search"}
          </Button>
        </form>
      </Card>

      {/* Fundis List */}
      {loading ? (
        <Card className="p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading fundis...</p>
        </Card>
      ) : (
        <>
          <div className="grid gap-4">
            {fundis.map((fundi, idx) => (
              <motion.div key={fundi.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
                <Card className="p-6 hover:border-primary/40 transition cursor-pointer" onClick={() => handleOpenModal(fundi)}>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                    {/* Avatar */}
                    <div className="md:col-span-1">
                      <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-primary to-orange-600 flex items-center justify-center text-white font-bold text-lg">
                        {fundi.firstName[0]}{fundi.lastName[0]}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="md:col-span-2 space-y-1">
                      <h3 className="font-semibold text-lg">
                        {fundi.firstName} {fundi.lastName}
                      </h3>
                      <p className="text-sm text-muted-foreground">{fundi.email}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-4 h-4" /> ID: {fundi.idNumber}
                      </p>
                    </div>

                    {/* Skills */}
                    <div className="md:col-span-1 flex flex-wrap gap-1">
                      {fundi.skills?.slice(0, 2).map((skill) => (
                        <span key={skill} className="px-2 py-1 bg-primary/10 text-primary rounded text-xs font-medium">
                          {skill}
                        </span>
                      ))}
                      {fundi.skills?.length > 2 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-medium">
                          +{fundi.skills.length - 2}
                        </span>
                      )}
                    </div>

                    {/* Status & Action */}
                    <div className="md:col-span-1 flex flex-col items-end gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1 ${getStatusColor(fundi.verificationStatus)}`}>
                        {getStatusIcon(fundi.verificationStatus)}
                        {fundi.verificationStatus.charAt(0).toUpperCase() + fundi.verificationStatus.slice(1)}
                      </span>
                      <Button size="sm" variant="outline" className="w-full" onClick={(e) => {
                        e.stopPropagation();
                        handleOpenModal(fundi);
                      }}>
                        <Eye className="w-4 h-4 mr-1" /> Review
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                disabled={pagination.page === 1}
                onClick={() => fetchFundis(pagination.page - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.pages}
              </span>
              <Button
                variant="outline"
                disabled={pagination.page === pagination.pages}
                onClick={() => fetchFundis(pagination.page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      {/* Modal */}
      {showModal && selectedFundi && (
        <FundiVerificationModal
          fundi={selectedFundi}
          onClose={() => {
            setShowModal(false);
            handleRefresh();
          }}
        />
      )}
    </div>
  );
}
