import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRef } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import CreateJob from "./pages/CreateJob";
import FundiRegister from "./pages/FundiRegister";
import NotFound from "./pages/NotFound";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminLayout from "./components/admin/AdminLayout";
import AdminDashboard from "./pages/admin/Dashboard";
import VerificationManagement from "./pages/admin/VerificationManagement";
import JobManagement from "./pages/admin/JobManagement";
import UserManagement from "./pages/admin/UserManagement";
import DisputesAndReports from "./pages/admin/DisputesAndReports";

const App = () => {
  const qcRef = useRef<QueryClient | null>(null);
  if (!qcRef.current) qcRef.current = new QueryClient();

  return (
    <QueryClientProvider client={qcRef.current}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/create-job" element={<CreateJob />} />
            <Route path="/fundi/register" element={<FundiRegister />} />
            
            {/* Admin Routes */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route element={<AdminLayout />}>
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/verification" element={<VerificationManagement />} />
              <Route path="/admin/jobs" element={<JobManagement />} />
              <Route path="/admin/users" element={<UserManagement />} />
              <Route path="/admin/disputes" element={<DisputesAndReports />} />
            </Route>
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
