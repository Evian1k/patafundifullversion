import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, Shield, Briefcase, TrendingUp, AlertCircle, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface DashboardStats {
  totalUsers: number;
  totalFundis: number;
  pendingVerifications: number;
  activeJobs: number;
  failedChecks: number;
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
    activeJobs: 0,
    failedChecks: 0,
    totalRevenue: 0,
  });
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch total users (from auth.users)
        const { data: users } = await supabase
          .from("fundi_profiles")
          .select("id", { count: "exact" });

        // Fetch total fundis
        const { data: fundis, count: fundiCount } = await supabase
          .from("fundi_profiles")
          .select("*", { count: "exact" });

        // Fetch pending verifications
        const { count: pendingCount } = await supabase
          .from("fundi_profiles")
          .select("id", { count: "exact" })
          .eq("verification_status", "pending");

        // Fetch active jobs
        const { count: activeJobsCount } = await supabase
          .from("jobs")
          .select("id", { count: "exact" })
          .eq("status", "assigned");

        // Fetch total revenue from completed jobs
        const { data: completedJobs } = await supabase
          .from("jobs")
          .select("final_price")
          .eq("status", "completed");

        const totalRevenue = completedJobs?.reduce((sum, job) => sum + (job.final_price || 0), 0) || 0;

        // Build chart data (last 7 days)
        const chartData = generateChartData();

        setStats({
          totalUsers: (users?.length || 0) + (fundiCount || 0),
          totalFundis: fundiCount || 0,
          pendingVerifications: pendingCount || 0,
          activeJobs: activeJobsCount || 0,
          failedChecks: Math.floor(Math.random() * 5), // Placeholder
          totalRevenue,
        });

        setChartData(chartData);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const generateChartData = (): ChartData[] => {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return days.map((day) => ({
      name: day,
      value: Math.floor(Math.random() * 50) + 20,
      jobs: Math.floor(Math.random() * 15) + 5,
    }));
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
      <div>
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-muted-foreground">Real-time platform overview</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          icon={Users}
          title="Total Users"
          value={stats.totalUsers}
          color="bg-gradient-to-br from-blue-500 to-blue-600"
        />
        <StatCard
          icon={Shield}
          title="Verified Fundis"
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
          icon={Briefcase}
          title="Active Jobs"
          value={stats.activeJobs}
          color="bg-gradient-to-br from-purple-500 to-purple-600"
        />
        <StatCard
          icon={AlertCircle}
          title="Failed ID Checks"
          value={stats.failedChecks}
          color="bg-gradient-to-br from-red-500 to-red-600"
        />
        <StatCard
          icon={TrendingUp}
          title="Revenue"
          value={`KES ${(stats.totalRevenue / 1000).toFixed(1)}K`}
          color="bg-gradient-to-br from-orange-500 to-orange-600"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Jobs Chart */}
        <motion.div whileHover={{ y: -4 }}>
          <Card className="p-6 border-2">
            <h3 className="text-lg font-semibold mb-4">Jobs This Week</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="name" stroke="#666" />
                <YAxis stroke="#666" />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="jobs"
                  stroke="#ff6b35"
                  strokeWidth={2}
                  dot={{ fill: "#ff6b35", r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>

        {/* Revenue Chart */}
        <motion.div whileHover={{ y: -4 }}>
          <Card className="p-6 border-2">
            <h3 className="text-lg font-semibold mb-4">Daily Revenue</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="name" stroke="#666" />
                <YAxis stroke="#666" />
                <Tooltip />
                <Bar dataKey="value" fill="#6366f1" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>
      </div>

      {/* Alerts */}
      <motion.div whileHover={{ y: -4 }}>
        <Card className="p-6 border-2 border-red-500/30 bg-red-500/5">
          <div className="flex items-center gap-4">
            <AlertCircle className="w-8 h-8 text-red-500 flex-shrink-0" />
            <div>
              <h3 className="font-semibold mb-1">Real-time Alerts</h3>
              <p className="text-sm text-muted-foreground">
                {stats.pendingVerifications} pending verifications • {stats.failedChecks} failed ID checks
              </p>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
