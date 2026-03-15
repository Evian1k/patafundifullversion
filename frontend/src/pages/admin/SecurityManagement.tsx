import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Shield,
  Loader2,
  Lock,
  Eye,
  Ban,
  CheckCircle,
  LogOut,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import AdminLayout from "@/components/admin/AdminLayout";

interface SecurityAlert {
  id: string;
  type: string;
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  targetUserId: string;
  targetUserName: string;
  createdAt: string;
  resolved: boolean;
}

export default function SecurityManagement() {
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterResolved, setFilterResolved] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const response = await apiClient.request("/admin/security-alerts", {
        includeAuth: true,
      });
      setAlerts(response.alerts || []);
    } catch (error) {
      console.error("Error fetching alerts:", error);
      toast.error("Failed to load security alerts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const handleResolveAlert = async (alertId: string) => {
    setResolving(alertId);
    try {
      await apiClient.request(`/admin/security-alerts/${alertId}/resolve`, {
        method: "POST",
        includeAuth: true,
      });
      toast.success("Alert resolved");
      fetchAlerts();
    } catch (error: any) {
      toast.error(error.message || "Failed to resolve alert");
    } finally {
      setResolving(null);
    }
  };

  const handleForceLogout = async (userId: string) => {
    try {
      await apiClient.request(`/admin/users/${userId}/force-logout`, {
        method: "POST",
        includeAuth: true,
      });
      toast.success("User logged out successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to logout user");
    }
  };

  const handleDisableAccount = async (userId: string) => {
    try {
      await apiClient.request(`/admin/users/${userId}/disable`, {
        method: "POST",
        includeAuth: true,
      });
      toast.success("Account disabled successfully");
      fetchAlerts();
    } catch (error: any) {
      toast.error(error.message || "Failed to disable account");
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "bg-red-100 text-red-800 border-red-300";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "low":
        return "bg-blue-100 text-blue-800 border-blue-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "high":
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case "medium":
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      default:
        return <Shield className="w-5 h-5 text-blue-600" />;
    }
  };

  const filteredAlerts = alerts.filter(
    (alert) =>
      (filterResolved ? !alert.resolved : true) &&
      (searchQuery
        ? alert.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          alert.targetUserName
            .toLowerCase()
            .includes(searchQuery.toLowerCase())
        : true)
  );

  return (
    <AdminLayout>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Security & Fraud Control</h1>
            <p className="text-muted-foreground mt-1">
              Monitor and manage security alerts
            </p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-red-100 rounded-lg border border-red-300">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span className="font-semibold text-red-600">
              {alerts.filter((a) => !a.resolved).length} Unresolved Alerts
            </span>
          </div>
        </div>

        {/* Filters */}
        <Card className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              placeholder="Search alerts by title or user..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <label className="flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                checked={filterResolved}
                onChange={(e) => setFilterResolved(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium">
                Show only unresolved alerts
              </span>
            </label>
          </div>
        </Card>

        {/* Alerts List */}
        {loading ? (
          <Card className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading security alerts...</p>
          </Card>
        ) : filteredAlerts.length === 0 ? (
          <Card className="p-12 text-center">
            <Shield className="w-12 h-12 mx-auto mb-4 text-green-500" />
            <h3 className="text-lg font-semibold mb-2">All Clear!</h3>
            <p className="text-muted-foreground">
              No security alerts at the moment
            </p>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredAlerts.map((alert) => (
              <motion.div key={alert.id} whileHover={{ y: -2 }}>
                <Card
                  className={`p-6 border-2 ${
                    alert.resolved
                      ? "bg-gray-50 border-gray-200"
                      : `border-l-4 ${getSeverityColor(alert.severity)}`
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        {getSeverityIcon(alert.severity)}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {alert.title}
                          </h3>
                          <p className="text-sm text-gray-600 mt-1">
                            {alert.description}
                          </p>
                          <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-gray-600">
                            <span className="font-medium">
                              User: {alert.targetUserName}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(alert.createdAt).toLocaleDateString(
                                "en-KE",
                                {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 ml-4 flex-shrink-0">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium border ${getSeverityColor(
                            alert.severity
                          )}`}
                        >
                          {alert.severity.toUpperCase()}
                        </span>
                        {alert.resolved && (
                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-300 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Resolved
                          </span>
                        )}
                      </div>
                    </div>

                    {!alert.resolved && (
                      <div className="flex flex-wrap gap-2 pt-4 border-t">
                        <Button
                          onClick={() => handleForceLogout(alert.targetUserId)}
                          variant="outline"
                          size="sm"
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <LogOut className="w-4 h-4 mr-1" />
                          Force Logout
                        </Button>
                        <Button
                          onClick={() =>
                            handleDisableAccount(alert.targetUserId)
                          }
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Ban className="w-4 h-4 mr-1" />
                          Disable Account
                        </Button>
                        <Button
                          onClick={() => handleResolveAlert(alert.id)}
                          disabled={resolving === alert.id}
                          variant="outline"
                          size="sm"
                          className="text-green-600 hover:text-green-700"
                        >
                          {resolving === alert.id ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                              Resolving...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Resolve
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
