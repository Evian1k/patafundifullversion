import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Mail,
  Phone,
  Loader2,
  MoreVertical,
  Ban,
  Eye,
  MessageSquare,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import AdminLayout from "@/components/admin/AdminLayout";

interface Customer {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  jobCount: number;
  createdAt: string;
  status?: string | null;
  emailVerified?: boolean;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export default function CustomerManagement() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 10,
    total: 0,
    pages: 1,
  });
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchCustomers = async (page = 1) => {
    setLoading(true);
    try {
      let endpoint = `/admin/customers?page=${page}&limit=${pagination.limit}`;
      if (searchQuery) {
        endpoint += `&q=${encodeURIComponent(searchQuery)}`;
      }

      const response = await apiClient.request(endpoint, { includeAuth: true });
      
      if (response && response.success) {
        setCustomers(response.customers || []);
        setPagination(response.pagination || { page, limit: 10, total: 0, pages: 1 });
      } else {
        setCustomers([]);
        setPagination({ page, limit: 10, total: 0, pages: 1 });
      }
    } catch (error) {
      console.error("Error fetching customers:", error);
      setCustomers([]);
      setPagination({ page, limit: 10, total: 0, pages: 1 });
      const msg = error instanceof Error ? error.message : "";
      if (
        msg.toLowerCase().includes("access denied") ||
        msg.toLowerCase().includes("authentication required") ||
        msg.toLowerCase().includes("invalid or expired token") ||
        msg.toLowerCase().includes("token revoked") ||
        msg.toLowerCase().includes("user not found")
      ) {
        localStorage.removeItem("auth_token");
        toast.error("Admin session expired. Please sign in again.");
        navigate("/admin/login");
        return;
      }
      toast.error("Failed to load customers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers(1);
    const id = window.setInterval(() => fetchCustomers(pagination.page), 15_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCustomers(1);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-KE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleBlockCustomer = async (customerId: string) => {
    setActionLoading(customerId);
    try {
      await apiClient.request(`/admin/customers/${customerId}/block`, {
        method: "POST",
        includeAuth: true,
      });
      toast.success("Customer blocked successfully");
      fetchCustomers(pagination.page);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "";
      toast.error(msg || "Failed to block customer");
    } finally {
      setActionLoading(null);
      setOpenMenu(null);
    }
  };

  const handleUnblockCustomer = async (customerId: string) => {
    setActionLoading(customerId);
    try {
      await apiClient.request(`/admin/customers/${customerId}/unblock`, {
        method: "POST",
        includeAuth: true,
      });
      toast.success("Customer unblocked successfully");
      fetchCustomers(pagination.page);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "";
      toast.error(msg || "Failed to unblock customer");
    } finally {
      setActionLoading(null);
      setOpenMenu(null);
    }
  };

  return (
    <AdminLayout>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Customer Management</h1>
            <p className="text-muted-foreground mt-1">
              View and manage platform customers
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Total Customers</p>
            <p className="text-2xl font-bold">{pagination.total}</p>
          </div>
        </div>

        {/* Search and Filter */}
        <Card className="p-6">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Searching..." : "Search"}
            </Button>
          </form>
        </Card>

        {/* Customers Table */}
        {loading ? (
          <Card className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading customers...</p>
          </Card>
        ) : customers.length === 0 ? (
          <Card className="p-12 text-center">
            <Mail className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold mb-2">No Customers Found</h3>
            <p className="text-muted-foreground">
              {searchQuery
                ? "Try adjusting your search criteria"
                : "No customers registered yet"}
            </p>
          </Card>
        ) : (
          <>
            <div className="grid gap-4">
              {customers.map((customer) => (
                <motion.div
                  key={customer.id}
                  whileHover={{ y: -2 }}
                  className="relative"
                >
                  <Card className="p-6 hover:shadow-md transition">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-start gap-4">
                              <div className="w-12 h-12 bg-gradient-to-br from-primary to-orange-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                            {(customer.fullName || customer.email || "?").charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {customer.fullName || customer.email}
                            </h3>
                            <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-600">
                              <div className="flex items-center gap-1">
                                <Mail className="w-4 h-4" />
                                <a
                                  href={`mailto:${customer.email}`}
                                  className="hover:text-primary"
                                >
                                  {customer.email}
                                </a>
                              </div>
                              <div className="flex items-center gap-1">
                                <Phone className="w-4 h-4" />
                                {customer.phone || "N/A"}
                              </div>
                              <div className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                                {customer.jobCount} jobs
                              </div>
                              {typeof customer.emailVerified === "boolean" && (
                                <div
                                  className={`text-xs px-2 py-1 rounded ${
                                    customer.emailVerified ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                                  }`}
                                >
                                  {customer.emailVerified ? "verified" : "unverified"}
                                </div>
                              )}
                              <div className="text-xs text-gray-500">
                                Joined {formatDate(customer.createdAt)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-gray-600 hover:text-primary"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-gray-600 hover:text-blue-600"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </Button>
                        <div className="relative">
                          <button
                            onClick={() =>
                              setOpenMenu(
                                openMenu === customer.id ? null : customer.id
                              )
                            }
                            className="p-2 hover:bg-gray-100 rounded transition"
                          >
                            <MoreVertical className="w-4 h-4 text-gray-600" />
                          </button>

                          {openMenu === customer.id && (
                            <motion.div
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-lg border border-gray-200 z-50"
                            >
                              <button
                                onClick={() => {
                                  const blocked = customer.status === "blocked" || customer.status === "disabled";
                                  if (blocked) handleUnblockCustomer(customer.id);
                                  else handleBlockCustomer(customer.id);
                                }}
                                disabled={
                                  actionLoading === customer.id
                                }
                                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-t transition flex items-center gap-2 disabled:opacity-50"
                              >
                                {actionLoading === customer.id ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Updating...
                                  </>
                                ) : (
                                  <>
                                    <Ban className="w-4 h-4" />
                                    {customer.status === "blocked" || customer.status === "disabled"
                                      ? "Unblock Customer"
                                      : "Block Customer"}
                                  </>
                                )}
                              </button>
                            </motion.div>
                          )}
                        </div>
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
                      fetchCustomers(Math.max(1, pagination.page - 1))
                    }
                    disabled={pagination.page === 1 || loading}
                    variant="outline"
                  >
                    Previous
                  </Button>
                  <Button
                    onClick={() =>
                      fetchCustomers(
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
