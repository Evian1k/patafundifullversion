import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  Loader2,
  Filter,
  Search,
  Download,
  Eye,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import AdminLayout from "@/components/admin/AdminLayout";

interface AuditLog {
  id: string;
  adminId: string;
  actionType: string;
  targetType: string;
  targetId: string;
  reason: string;
  createdAt: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 50,
    total: 0,
    pages: 1,
  });

  const fetchLogs = async (page = 1) => {
    setLoading(true);
    try {
      let endpoint = `/admin/action-logs?page=${page}&limit=${pagination.limit}`;
      if (searchQuery) {
        endpoint += `&q=${encodeURIComponent(searchQuery)}`;
      }
      if (actionFilter) {
        endpoint += `&actionType=${actionFilter}`;
      }

      const response = await apiClient.request(endpoint, { includeAuth: true });
      setLogs(response.logs || []);
      setPagination(response.pagination || { page, limit: 50, total: 0, pages: 1 });
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      toast.error("Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs(1);
  };

  const handleExportLogs = () => {
    try {
      const csv = [
        ["ID", "Action", "Target", "Target ID", "Reason", "Timestamp"],
        ...logs.map((log) => [
          log.id,
          log.actionType,
          log.targetType,
          log.targetId,
          log.reason || "",
          new Date(log.createdAt).toISOString(),
        ]),
      ]
        .map((row) => row.join(","))
        .join("\n");

      const blob = new Blob([csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Logs exported successfully");
    } catch (error) {
      toast.error("Failed to export logs");
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "approve":
      case "activate":
        return "bg-green-100 text-green-800 border-green-300";
      case "reject":
      case "disable":
        return "bg-red-100 text-red-800 border-red-300";
      case "suspend":
        return "bg-orange-100 text-orange-800 border-orange-300";
      case "block":
      case "force_logout":
        return "bg-red-100 text-red-800 border-red-300";
      default:
        return "bg-blue-100 text-blue-800 border-blue-300";
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-KE", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <AdminLayout>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Audit Logs</h1>
            <p className="text-muted-foreground mt-1">
              View all admin actions and system events
            </p>
          </div>
          <Button onClick={handleExportLogs} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Filters */}
        <Card className="p-6 space-y-4">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by target ID or admin..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="px-4 py-2 border rounded-lg bg-white"
              >
                <option value="">All Actions</option>
                <option value="approve">Approve</option>
                <option value="reject">Reject</option>
                <option value="suspend">Suspend</option>
                <option value="block">Block</option>
                <option value="force_logout">Force Logout</option>
                <option value="disable">Disable</option>
              </select>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Searching..." : "Filter Logs"}
            </Button>
          </form>
        </Card>

        {/* Logs Table */}
        {loading ? (
          <Card className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading audit logs...</p>
          </Card>
        ) : logs.length === 0 ? (
          <Card className="p-12 text-center">
            <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold mb-2">No Logs Found</h3>
            <p className="text-muted-foreground">
              {searchQuery
                ? "Try adjusting your search criteria"
                : "No audit logs available"}
            </p>
          </Card>
        ) : (
          <>
            <Card className="border-2 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                        Action
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                        Target
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                        Target ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                        Reason
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                        Timestamp
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium border ${getActionColor(
                              log.actionType
                            )}`}
                          >
                            {log.actionType.replace("_", " ").toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {log.targetType}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 font-mono">
                          {log.targetId.substring(0, 12)}...
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {log.reason || "—"}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                          {formatDate(log.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-sm text-gray-600">
                  Page {pagination.page} of {pagination.pages} (Total:{" "}
                  {pagination.total} logs)
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={() =>
                      fetchLogs(Math.max(1, pagination.page - 1))
                    }
                    disabled={pagination.page === 1 || loading}
                    variant="outline"
                  >
                    Previous
                  </Button>
                  <Button
                    onClick={() =>
                      fetchLogs(
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
