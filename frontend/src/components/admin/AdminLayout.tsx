import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  Shield,
  TrendingUp,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Briefcase,
  CreditCard,
  AlertTriangle,
  CheckCircle,
  Bell,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);

  const menuItems = [
    {
      icon: LayoutDashboard,
      label: "Dashboard",
      path: "/admin/dashboard",
      color: "text-blue-500",
    },
    {
      icon: Shield,
      label: "Fundi Verification",
      path: "/admin/fundis",
      color: "text-green-500",
    },
    {
      icon: Users,
      label: "Customers",
      path: "/admin/customers",
      color: "text-purple-500",
    },
    {
      icon: Briefcase,
      label: "Jobs",
      path: "/admin/jobs",
      color: "text-orange-500",
    },
    {
      icon: CreditCard,
      label: "Payments",
      path: "/admin/payments",
      color: "text-emerald-500",
    },
    {
      icon: AlertTriangle,
      label: "Security",
      path: "/admin/security",
      color: "text-red-500",
    },
    {
      icon: BarChart3,
      label: "Reports",
      path: "/admin/reports",
      color: "text-cyan-500",
    },
    {
      icon: Settings,
      label: "Settings",
      path: "/admin/settings",
      color: "text-gray-500",
    },
    {
      icon: FileText,
      label: "Audit Logs",
      path: "/admin/audit-logs",
      color: "text-indigo-500",
    },
  ];

  const handleLogout = async () => {
    try {
      await apiClient.logout();
      localStorage.removeItem("token");
      toast.success("Logged out successfully");
      navigate("/admin/login");
    } catch (error) {
      console.error("Logout error:", error);
      localStorage.removeItem("token");
      navigate("/admin/login");
    }
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <motion.aside
        initial={{ x: -280 }}
        animate={{ x: 0 }}
        transition={{ duration: 0.3 }}
        className={`${
          sidebarOpen ? "w-72" : "w-20"
        } bg-gradient-to-b from-slate-900 to-slate-800 border-r border-slate-700 flex flex-col transition-all duration-300 overflow-y-auto`}
      >
        {/* Logo Section */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-primary to-orange-600 rounded-lg">
              <Shield className="w-6 h-6 text-white" />
            </div>
            {sidebarOpen && (
              <div>
                <h1 className="text-white font-bold text-lg">FixIt Admin</h1>
                <p className="text-xs text-slate-400">Management Panel</p>
              </div>
            )}
          </div>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            return (
              <motion.button
                key={item.path}
                onClick={() => navigate(item.path)}
                whileHover={{ x: 4 }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  active
                    ? "bg-primary/20 border-l-4 border-primary text-primary"
                    : "text-slate-300 hover:bg-slate-700/50"
                }`}
                title={item.label}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${item.color}`} />
                {sidebarOpen && (
                  <span className="text-sm font-medium truncate">
                    {item.label}
                  </span>
                )}
              </motion.button>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-slate-700">
          <Button
            onClick={handleLogout}
            variant="ghost"
            className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-500/10"
          >
            <LogOut className="w-5 h-5 mr-2" />
            {sidebarOpen && "Logout"}
          </Button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              {sidebarOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
            <h2 className="text-lg font-semibold text-gray-900">
              Admin Panel
            </h2>
          </div>

          <div className="flex items-center gap-4">
            {/* Notifications */}
            <button 
              title="Notifications"
              className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>

            {/* Profile */}
            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-3 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-primary to-orange-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                  A
                </div>
                <span>Admin</span>
              </button>

              {profileOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50"
                >
                  <div className="p-4 border-b border-gray-200">
                    <p className="text-sm font-semibold text-gray-900">
                      Admin Account
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {localStorage.getItem("adminEmail") || "admin@fixit.co.ke"}
                    </p>
                  </div>
                  <div className="p-2">
                    <button
                      onClick={() => {
                        navigate("/admin/settings");
                        setProfileOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded transition flex items-center gap-2"
                    >
                      <Settings className="w-4 h-4" />
                      Settings
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded transition flex items-center gap-2"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-gray-50">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
