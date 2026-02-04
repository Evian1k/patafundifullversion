import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, Shield, Briefcase, TrendingUp, AlertCircle, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { apiClient } from "@/lib/api";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface DashboardStats {
  totalUsers: number;
  totalFundis: number;
  pendingVerifications: number;
  approvedFundis: number;
  rejectedFundis: number;
  suspendedFundis: number;
  activeJobs: number;
  completedJobs: number;
  totalRevenue: number;
}

interface ChartData {
  name: string;
  value: number;
  jobs?: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalFundis: 0,
    pendingVerifications: 0,
    approvedFundis: 0,
    rejectedFundis: 0,
    suspendedFundis: 0,
    activeJobs: 0,
    completedJobs: 0,
    totalRevenue: 0,
  });
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const response = await apiClient.request('/admin/dashboard-stats', { includeAuth: true });
      setStats({
        totalUsers: response.stats?.totalUsers || 0,
        totalFundis: response.stats?.totalFundis || 0,
        pendingVerifications: response.stats?.pendingVerifications || 0,
        approvedFundis: response.stats?.approvedFundis || 0,
        rejectedFundis: response.stats?.rejectedFundis || 0,
        suspendedFundis: response.stats?.suspendedFundis || 0,
        activeJobs: response.stats?.activeJobs || 0,
        completedJobs: response.stats?.completedJobs || 0,
        totalRevenue: response.stats?.totalRevenue || 0,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setStats({
        totalUsers: 0,
        totalFundis: 0,
        pendingVerifications: 0,
        approvedFundis: 0,
        rejectedFundis: 0,
        suspendedFundis: 0,
        activeJobs: 0,
        completedJobs: 0,
        totalRevenue: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Helper: format currency consistently
  const formatCurrency = (amount: number) => {
    if (!amount) return 'KES 0';
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(amount);
  };

  const StatCard = ({ icon: Icon, title, value, color }: any) => (
    <motion.div whileHover={{ y: -4 }} className="flex-1 min-w-[200px]">
      <Card className="p-6 border-2 hover:border-primary/40 transition">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-2">{title}</p>
            <h3 className="text-3xl font-bold">{loading ? "..." : value}</h3>
          </div>
          <div className={`p-3 rounded-lg ${color}`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
      </Card>
    </motion.div>
  );

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1">Dashboard</h1>
          <p className="text-muted-foreground">Real-time platform overview</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchDashboardData}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-white hover:opacity-95"
          >
            Refresh
          </button>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-gray-200 bg-white text-gray-700"
          >
            Reload
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={Users}
          title="Total Users"
          value={stats.totalUsers}
          color="bg-gradient-to-br from-blue-500 to-blue-600"
        />
        <StatCard
          icon={Shield}
          title="Total Fundis"
          value={stats.totalFundis}
          color="bg-gradient-to-br from-green-500 to-green-600"
        />
        <StatCard
          icon={Clock}
          title="Pending Verifications"
          value={stats.pendingVerifications}
          color="bg-gradient-to-br from-yellow-500 to-yellow-600"
        />
        <StatCard
          icon={AlertCircle}
          title="Approved Fundis"
          value={stats.approvedFundis}
          color="bg-gradient-to-br from-emerald-500 to-emerald-600"
        />
        <StatCard
          icon={AlertCircle}
          title="Rejected Fundis"
          value={stats.rejectedFundis}
          color="bg-gradient-to-br from-red-500 to-red-600"
        />
        <StatCard
          icon={AlertCircle}
          title="Suspended Fundis"
          value={stats.suspendedFundis}
          color="bg-gradient-to-br from-orange-500 to-orange-600"
        />
        <StatCard
          icon={Briefcase}
          title="Active Jobs"
          value={stats.activeJobs}
          color="bg-gradient-to-br from-purple-500 to-purple-600"
        />
        <StatCard
          icon={TrendingUp}
          title="Total Revenue"
          value={formatCurrency(stats.totalRevenue)}
          color="bg-gradient-to-br from-pink-500 to-pink-600"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Jobs Chart */}
        <motion.div whileHover={{ y: -4 }}>
          <Card className="p-6 border-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Jobs This Week</h3>
              <p className="text-sm text-muted-foreground">{loading ? 'Loading...' : `${chartData.length} points`}</p>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e6e6e6" />
                <XAxis dataKey="name" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="jobs"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  dot={{ fill: "#0ea5e9", r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>

        {/* Revenue Chart */}
        <motion.div whileHover={{ y: -4 }}>
          <Card className="p-6 border-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Daily Revenue</h3>
              <p className="text-sm text-muted-foreground">{loading ? 'Loading...' : 'From transactions'}</p>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e6e6e6" />
                <XAxis dataKey="name" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip />
                <Bar dataKey="value" fill="#7c3aed" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>
      </div>

      {/* Alerts */}
      <motion.div whileHover={{ y: -4 }}>
        <Card className="p-6 border-2 border-yellow-500/20 bg-yellow-50">
          <div className="flex items-center gap-4">
            <AlertCircle className="w-8 h-8 text-yellow-600 flex-shrink-0" />
            <div>
              <h3 className="font-semibold mb-1">Pending Actions</h3>
              <p className="text-sm text-muted-foreground">
                {stats.pendingVerifications} pending verifications • {stats.rejectedFundis} rejected • {stats.suspendedFundis} suspended
              </p>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
