import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  TrendingUp,
  Download,
  Loader2,
  Calendar,
  Users,
  Briefcase,
  DollarSign,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import AdminLayout from "@/components/admin/AdminLayout";

interface ReportData {
  date: string;
  jobs: number;
  revenue: number;
  customers: number;
  fundis: number;
}

interface TopFundi {
  id: string;
  name: string;
  jobCount: number;
  rating: number;
}

export default function ReportsAnalytics() {
  const [reportData, setReportData] = useState<ReportData[]>([]);
  const [topFundis, setTopFundis] = useState<TopFundi[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d">("30d");

  const fetchReports = async () => {
    setLoading(true);
    try {
      const response = await apiClient.request(
        `/admin/reports?range=${dateRange}`,
        { includeAuth: true }
      );
      // Normalize response shapes and provide safe defaults
      const chartData = Array.isArray(response.chartData) ? response.chartData : [];
      const normalizedChartData = chartData.map((r: any) => ({
        date: r.date || "",
        jobs: typeof r.jobs === "number" ? r.jobs : Number(r.jobs) || 0,
        revenue: typeof r.revenue === "number" ? r.revenue : Number(r.revenue) || 0,
        customers: typeof r.customers === "number" ? r.customers : Number(r.customers) || 0,
        fundis: typeof r.fundis === "number" ? r.fundis : Number(r.fundis) || 0,
      }));

      const top = Array.isArray(response.topFundis) ? response.topFundis : [];
      const normalizedTop = top.map((t: any) => ({
        id: t.id ?? `${t.name ?? "unknown"}-${Math.random().toString(36).slice(2,8)}`,
        name: t.name ?? "Unknown",
        jobCount: typeof t.jobCount === "number" ? t.jobCount : Number(t.jobCount) || 0,
        rating: typeof t.rating === "number" ? t.rating : Number(t.rating) || 0,
      }));

      setReportData(normalizedChartData);
      setTopFundis(normalizedTop);
    } catch (error) {
      console.error("Error fetching reports:", error);
      toast.error("Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [dateRange]);

  const handleExportCSV = () => {
    try {
      const csv = [
        ["Date", "Jobs", "Revenue", "Customers", "Fundis"],
        ...reportData.map((row) => [
          row.date,
          row.jobs,
          row.revenue,
          row.customers,
          row.fundis,
        ]),
      ]
        .map((row) => row.join(","))
        .join("\n");

      const blob = new Blob([csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fixit-report-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Report exported successfully");
    } catch (error) {
      toast.error("Failed to export report");
    }
  };

  const stats = reportData.length > 0 ? reportData[reportData.length - 1] : null;

  return (
    <AdminLayout>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Reports & Analytics</h1>
            <p className="text-muted-foreground mt-1">
              View platform performance metrics
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={dateRange}
              onChange={(e) =>
                setDateRange(e.target.value as "7d" | "30d" | "90d")
              }
              className="px-4 py-2 border rounded-lg bg-white"
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
            </select>

            <Button onClick={handleExportCSV} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Key Metrics */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <motion.div whileHover={{ y: -4 }}>
              <Card className="p-6 border-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Jobs Completed
                    </p>
                    <h3 className="text-3xl font-bold">{stats.jobs ?? 0}</h3>
                  </div>
                  <div className="p-3 bg-blue-500/10 rounded-lg">
                    <Briefcase className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div whileHover={{ y: -4 }}>
              <Card className="p-6 border-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Total Revenue
                    </p>
                    <h3 className="text-3xl font-bold">
                      {new Intl.NumberFormat("en-KE", {
                        style: "currency",
                        currency: "KES",
                        maximumFractionDigits: 0,
                      }).format(stats.revenue ?? 0)}
                    </h3>
                  </div>
                  <div className="p-3 bg-green-500/10 rounded-lg">
                    <DollarSign className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div whileHover={{ y: -4 }}>
              <Card className="p-6 border-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Active Customers
                    </p>
                    <h3 className="text-3xl font-bold">{stats.customers ?? 0}</h3>
                  </div>
                  <div className="p-3 bg-purple-500/10 rounded-lg">
                    <Users className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </Card>
            </motion.div>

            <motion.div whileHover={{ y: -4 }}>
              <Card className="p-6 border-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Active Fundis
                    </p>
                    <h3 className="text-3xl font-bold">{stats.fundis ?? 0}</h3>
                  </div>
                  <div className="p-3 bg-orange-500/10 rounded-lg">
                    <TrendingUp className="w-6 h-6 text-orange-600" />
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>
        )}

        {/* Charts */}
        {loading ? (
          <Card className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading reports...</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Chart */}
            <Card className="p-6 border-2">
              <h3 className="text-lg font-semibold mb-4">Revenue Trend</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={reportData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    style={{ fontSize: "12px" }}
                    tick={{ fill: "#666" }}
                  />
                  <YAxis
                    style={{ fontSize: "12px" }}
                    tick={{ fill: "#666" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #ccc",
                      borderRadius: "8px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ fill: "#10b981" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            {/* Jobs Chart */}
            <Card className="p-6 border-2">
              <h3 className="text-lg font-semibold mb-4">Jobs Completed</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={reportData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    style={{ fontSize: "12px" }}
                    tick={{ fill: "#666" }}
                  />
                  <YAxis
                    style={{ fontSize: "12px" }}
                    tick={{ fill: "#666" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #ccc",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="jobs" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {/* Top Fundis */}
        {!loading && topFundis.length > 0 && (
          <Card className="p-6 border-2">
            <h3 className="text-lg font-semibold mb-4">Top Performing Fundis</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      Jobs Completed
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      Rating
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {topFundis.map((fundi, idx) => (
                    <tr key={fundi.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        #{idx + 1} {fundi.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {fundi.jobCount} jobs
                      </td>
                        <td className="px-6 py-4 text-sm font-semibold text-yellow-600">
                        ⭐ {typeof fundi.rating === 'number' ? fundi.rating.toFixed(1) : String(fundi.rating ?? '—')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
