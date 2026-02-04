import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRef, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import CreateJob from "./pages/CreateJob";
import FundiRegister from "./pages/FundiRegister";
import Settings from "./pages/Settings";
import JobTracking from "./pages/JobTracking";
import NotFound from "./pages/NotFound";

// Admin pages
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/Dashboard";
import FundiVerificationManagement from "./pages/admin/FundiVerificationManagement";

const App = () => {
  const qcRef = useRef<QueryClient | null>(null);
  if (!qcRef.current) qcRef.current = new QueryClient();

  // Check admin access
  const isAdminPath = (path: string) => path.startsWith("/admin");
  const isAdmin = () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return false;
      // Decode JWT to check role (basic check)
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      const payload = JSON.parse(jsonPayload);
      return payload.role === 'admin';
    } catch (e) {
      return false;
    }
  };

  const ProtectedAdminRoute = ({ element }: { element: React.ReactNode }) => {
    return isAdmin() ? element : <Navigate to="/admin/login" />;
  };

  return (
    <QueryClientProvider client={qcRef.current}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/create-job" element={<CreateJob />} />
            <Route path="/job/:jobId/tracking" element={<JobTracking />} />
            <Route path="/fundi/register" element={<FundiRegister />} />
            <Route path="/settings" element={<Settings />} />

            {/* Admin Routes */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route
              path="/admin/dashboard"
              element={<ProtectedAdminRoute element={<AdminDashboard />} />}
            />
            <Route
              path="/admin/fundis"
              element={<ProtectedAdminRoute element={<FundiVerificationManagement />} />}
            />

            {/* Catch all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
