import { useState, useEffect } from "react";
import { useNavigate, Outlet } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Shield,
  AlertTriangle,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function AdminLayout() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [adminRole, setAdminRole] = useState<string>("");
  const [adminEmail, setAdminEmail] = useState<string>("");
  const [inactivityTimer, setInactivityTimer] = useState<NodeJS.Timeout | null>(null);

  // Auto-logout on inactivity (15 minutes)
  useEffect(() => {
    const resetTimer = () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      const timer = setTimeout(() => {
        handleLogout();
      }, 15 * 60 * 1000);
      setInactivityTimer(timer);
    };

    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((event) => document.addEventListener(event, resetTimer));

    resetTimer();

    return () => {
      events.forEach((event) => document.removeEventListener(event, resetTimer));
      if (inactivityTimer) clearTimeout(inactivityTimer);
    };
  }, [inactivityTimer]);

  // Check admin session on mount
  useEffect(() => {
    const adminSession = localStorage.getItem("admin_session");
    if (!adminSession) {
      navigate("/admin/login");
      return;
    }

    try {
      const session = JSON.parse(adminSession);
      setAdminRole(session.role);
      setAdminEmail(session.email);
    } catch {
      navigate("/admin/login");
    }
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      localStorage.removeItem("admin_session");
      toast.success("Logged out successfully");
      navigate("/admin/login");
    } catch (error) {
      console.error("Logout error:", error);
      localStorage.removeItem("admin_session");
      navigate("/admin/login");
    }
  };

  const navItems = [
    {
      label: "Dashboard",
      icon: LayoutDashboard,
      path: "/admin/dashboard",
      roles: ["super_admin", "support_admin"],
    },
    {
      label: "Fundi Verification",
      icon: Shield,
      path: "/admin/verification",
      roles: ["super_admin", "support_admin"],
    },
    {
      label: "Job Management",
      icon: Briefcase,
      path: "/admin/jobs",
      roles: ["super_admin", "support_admin"],
    },
    {
      label: "User Management",
      icon: Users,
      path: "/admin/users",
      roles: ["super_admin"],
    },
    {
      label: "Disputes & Reports",
      icon: AlertTriangle,
      path: "/admin/disputes",
      roles: ["super_admin", "support_admin"],
    },
    {
      label: "Settings",
      icon: Settings,
      path: "/admin/settings",
      roles: ["super_admin"],
    },
  ];

  const filteredNavItems = navItems.filter((item) =>
    item.roles.includes(adminRole)
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <motion.div
        initial={{ x: -256 }}
        animate={{ x: 0 }}
        className={`${
          sidebarOpen ? "w-64" : "w-20"
        } bg-gradient-to-b from-slate-900 to-slate-950 text-white transition-all duration-300 border-r border-primary/20 flex flex-col`}
      >
        {/* Logo */}
        <div className="p-4 border-b border-primary/20 flex items-center justify-between">
          {sidebarOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-gradient-to-br from-primary to-orange-600 rounded-lg">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-lg font-bold">Fixit Admin</h1>
                  <p className="text-xs text-slate-400">{adminRole}</p>
                </div>
              </div>
            </motion.div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 hover:bg-slate-800 rounded-lg transition"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 p-4 space-y-2">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <motion.button
                key={item.path}
                onClick={() => navigate(item.path)}
                whileHover={{ x: 4 }}
                className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition ${
                  isActive
                    ? "bg-gradient-to-r from-primary to-orange-600 text-white"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
              </motion.button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-primary/20 space-y-2">
          {sidebarOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <p className="text-xs text-slate-400 truncate">{adminEmail}</p>
            </motion.div>
          )}
          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full"
            size="sm"
          >
            <LogOut className="w-4 h-4 mr-2" />
            {sidebarOpen && "Logout"}
          </Button>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="h-16 bg-background border-b border-border flex items-center justify-between px-8">
          <h2 className="text-lg font-semibold">Admin Dashboard</h2>
          <motion.button
            whileHover={{ scale: 1.1 }}
            className="relative p-2 text-muted-foreground hover:text-foreground transition"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          </motion.button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
