import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import SuperAdmin from "./pages/SuperAdmin";
import SystemDashboard from "./pages/SystemDashboard";
// AssessmentList removed - functionality moved to Dashboard
import Assessment from "./pages/Assessment";
import UserManagement from "./pages/UserManagement";
import Reports from "./pages/Reports";
import ReportsQuantitative from "./pages/ReportsQuantitative";
import ReportsQuantitativeByArea from "./pages/ReportsQuantitativeByArea";
import ReportsQuantitativeDetail from "./pages/ReportsQuantitativeDetail";
import ReportsImpact from "./pages/ReportsImpact";
import InspectionSupervisor from "./pages/InspectionSupervisor";
import InspectionSupervisee from "./pages/InspectionSupervisee";
import InspectionRegionDetail from "./pages/InspectionRegionDetail";
import InspectionManual from "./pages/InspectionManual";
import ProfileSettings from "./pages/ProfileSettings";
import Unauthorized from "./pages/Unauthorized";
import NotFound from "./pages/NotFound";
// Public pages (no login required)
import PublicReports from "./pages/PublicReports";
import PublicReportsQuantitative from "./pages/PublicReportsQuantitative";
import PublicReportsImpact from "./pages/PublicReportsImpact";
import PublicInspectionSupervisor from "./pages/PublicInspectionSupervisor";
import PublicInspectionManual from "./pages/PublicInspectionManual";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // ⭐ ปิด refetch เมื่อกลับมาโฟกัสแท็บ
      refetchOnReconnect: true,
      staleTime: 60_000, // cache 1 นาที
      gcTime: 10 * 60_000, // เก็บ cache 10 นาที
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Default route redirects to public reports */}
            <Route path="/" element={<Navigate to="/public/reports" replace />} />
            <Route path="/login" element={<Login />} />
            
            {/* Public routes - no login required */}
            <Route path="/public/reports" element={<PublicReports />} />
            <Route path="/public/reports/quantitative" element={<PublicReportsQuantitative />} />
            <Route path="/public/reports/impact" element={<PublicReportsImpact />} />
            <Route path="/public/inspection/supervisor" element={<PublicInspectionSupervisor />} />
            <Route path="/public/inspection/manual" element={<PublicInspectionManual />} />
            
            <Route path="/unauthorized" element={<Unauthorized />} />
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            {/* Redirect /assessments to /dashboard */}
            <Route path="/assessments" element={<Navigate to="/dashboard" replace />} />
            <Route 
              path="/assessment/:id" 
              element={
                <ProtectedRoute>
                  <Assessment />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/user-management" 
              element={
                <ProtectedRoute allowedRoles={['provincial', 'regional']}>
                  <UserManagement />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/reports" 
              element={
                <ProtectedRoute>
                  <Reports />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/reports/quantitative" 
              element={
                <ProtectedRoute>
                  <ReportsQuantitative />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/reports/quantitative-by-area" 
              element={
                <ProtectedRoute>
                  <ReportsQuantitativeByArea />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/reports/quantitative-detail" 
              element={
                <ProtectedRoute>
                  <ReportsQuantitativeDetail />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/reports/impact" 
              element={
                <ProtectedRoute>
                  <ReportsImpact />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/inspection/supervisor" 
              element={
                <ProtectedRoute>
                  <InspectionSupervisor />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/inspection/supervisor/region/:regionId" 
              element={
                <ProtectedRoute>
                  <InspectionRegionDetail />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/inspection/supervisee" 
              element={
                <ProtectedRoute>
                  <InspectionSupervisee />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/inspection/manual" 
              element={
                <ProtectedRoute>
                  <InspectionManual />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/super-admin" 
              element={
                <ProtectedRoute allowedRoles={['central_admin', 'regional']}>
                  <SuperAdmin />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/profile" 
              element={
                <ProtectedRoute>
                  <ProfileSettings />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/system-dashboard" 
              element={
                <ProtectedRoute allowedRoles={['central_admin']}>
                  <SystemDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/*" 
              element={
                <ProtectedRoute allowedRoles={['central_admin']}>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
