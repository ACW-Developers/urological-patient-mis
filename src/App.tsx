import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { MainLayout } from "@/components/layout/MainLayout";

// Pages
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Patients from "./pages/Patients";
import PatientRegistration from "./pages/PatientRegistration";
import Vitals from "./pages/Vitals";
import Appointments from "./pages/Appointments";
import LabOrders from "./pages/LabOrders";
import LabResults from "./pages/LabResults";
import Prescriptions from "./pages/Prescriptions";
import Pharmacy from "./pages/Pharmacy";
import Surgeries from "./pages/Surgeries";
import ICU from "./pages/ICU";
import FollowUps from "./pages/FollowUps";
import UserManagement from "./pages/UserManagement";
import Settings from "./pages/Settings";
import Reports from "./pages/Reports";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <SettingsProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/auth" element={<Auth />} />
                
                {/* Protected Routes */}
                <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/patients" element={<Patients />} />
                  <Route path="/patients/register" element={
                    <ProtectedRoute allowedRoles={['admin', 'nurse']}><PatientRegistration /></ProtectedRoute>
                  } />
                  <Route path="/vitals" element={
                    <ProtectedRoute allowedRoles={['admin', 'nurse']}><Vitals /></ProtectedRoute>
                  } />
                  <Route path="/appointments" element={<Appointments />} />
                  <Route path="/lab/orders" element={<LabOrders />} />
                  <Route path="/lab/results" element={
                    <ProtectedRoute allowedRoles={['admin', 'lab_technician']}><LabResults /></ProtectedRoute>
                  } />
                  <Route path="/prescriptions" element={<Prescriptions />} />
                  <Route path="/pharmacy" element={
                    <ProtectedRoute allowedRoles={['admin', 'pharmacist']}><Pharmacy /></ProtectedRoute>
                  } />
                  <Route path="/surgeries" element={<Surgeries />} />
                  <Route path="/icu" element={<ICU />} />
                  <Route path="/follow-ups" element={<FollowUps />} />
                  <Route path="/admin/users" element={
                    <ProtectedRoute allowedRoles={['admin']}><UserManagement /></ProtectedRoute>
                  } />
                  <Route path="/settings" element={
                    <ProtectedRoute allowedRoles={['admin']}><Settings /></ProtectedRoute>
                  } />
                  <Route path="/reports" element={<Reports />} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </SettingsProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
