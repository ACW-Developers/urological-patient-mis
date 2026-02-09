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
import DoctorLabResults from "./pages/DoctorLabResults";
import Prescriptions from "./pages/Prescriptions";
import Pharmacy from "./pages/Pharmacy";
import PharmacyHistory from "./pages/PharmacyHistory";
import PreOperative from "./pages/PreOperative";
import IntraOperative from "./pages/IntraOperative";
import PostOperative from "./pages/PostOperative";
import ICU from "./pages/ICU";
import FollowUps from "./pages/FollowUps";
import UserManagement from "./pages/UserManagement";
import Settings from "./pages/Settings";
import Reports from "./pages/Reports";
import DoctorPatients from "./pages/DoctorPatients";
import DoctorSchedule from "./pages/DoctorSchedule";
import DoctorAppointments from "./pages/DoctorAppointments";
import DoctorConsultation from "./pages/DoctorConsultation";
import PatientDetail from "./pages/PatientDetail";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import Downloads from "./pages/Downloads";
import ResearchDashboard from "./pages/ResearchDashboard";
import ResearcherSettings from "./pages/ResearcherSettings";
import ActivityLogs from "./pages/ActivityLogs";
import Teleconferencing from "./pages/Teleconferencing";
import Ward from "./pages/Ward";

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
                  <Route path="/patients/:id" element={<PatientDetail />} />
                  <Route path="/patients/register" element={
                    <ProtectedRoute allowedRoles={['admin', 'nurse']}><PatientRegistration /></ProtectedRoute>
                  } />
                  <Route path="/vitals" element={
                    <ProtectedRoute allowedRoles={['admin', 'nurse']}><Vitals /></ProtectedRoute>
                  } />
                  <Route path="/appointments" element={<Appointments />} />
                  <Route path="/doctor/patients" element={
                    <ProtectedRoute allowedRoles={['doctor']}><DoctorPatients /></ProtectedRoute>
                  } />
                  <Route path="/doctor/appointments" element={
                    <ProtectedRoute allowedRoles={['doctor']}><DoctorAppointments /></ProtectedRoute>
                  } />
                  <Route path="/doctor/consultation" element={
                    <ProtectedRoute allowedRoles={['doctor', 'admin']}><DoctorConsultation /></ProtectedRoute>
                  } />
                  <Route path="/doctor/schedule" element={
                    <ProtectedRoute allowedRoles={['doctor']}><DoctorSchedule /></ProtectedRoute>
                  } />
                  <Route path="/lab/orders" element={<LabOrders />} />
                  <Route path="/lab/results" element={
                    <ProtectedRoute allowedRoles={['admin', 'lab_technician']}><LabResults /></ProtectedRoute>
                  } />
                  <Route path="/doctor/lab-results" element={
                    <ProtectedRoute allowedRoles={['doctor']}><DoctorLabResults /></ProtectedRoute>
                  } />
                  <Route path="/prescriptions" element={<Prescriptions />} />
                  <Route path="/pharmacy" element={
                    <ProtectedRoute allowedRoles={['admin', 'pharmacist']}><Pharmacy /></ProtectedRoute>
                  } />
                  <Route path="/pharmacy/history" element={
                    <ProtectedRoute allowedRoles={['pharmacist', 'admin']}><PharmacyHistory /></ProtectedRoute>
                  } />
                  <Route path="/pre-operative" element={
                    <ProtectedRoute allowedRoles={['admin', 'doctor', 'nurse']}><PreOperative /></ProtectedRoute>
                  } />
                  <Route path="/intra-operative" element={
                    <ProtectedRoute allowedRoles={['admin', 'doctor', 'nurse']}><IntraOperative /></ProtectedRoute>
                  } />
                  <Route path="/post-operative" element={
                    <ProtectedRoute allowedRoles={['admin', 'doctor', 'nurse']}><PostOperative /></ProtectedRoute>
                  } />
                  <Route path="/icu" element={<ICU />} />
                  <Route path="/follow-ups" element={<FollowUps />} />
                  <Route path="/teleconferencing" element={
                    <ProtectedRoute allowedRoles={['admin', 'doctor']}><Teleconferencing /></ProtectedRoute>
                  } />
                  <Route path="/ward" element={
                    <ProtectedRoute allowedRoles={['admin', 'doctor', 'nurse']}><Ward /></ProtectedRoute>
                  } />
                  <Route path="/admin/users" element={
                    <ProtectedRoute allowedRoles={['admin']}><UserManagement /></ProtectedRoute>
                  } />
                  <Route path="/admin/logs" element={
                    <ProtectedRoute allowedRoles={['admin']}><ActivityLogs /></ProtectedRoute>
                  } />
                  <Route path="/settings" element={
                    <ProtectedRoute allowedRoles={['admin']}><Settings /></ProtectedRoute>
                  } />
                  <Route path="/researcher/settings" element={
                    <ProtectedRoute allowedRoles={['researcher']}><ResearcherSettings /></ProtectedRoute>
                  } />
                  <Route path="/downloads" element={
                    <ProtectedRoute allowedRoles={['researcher']}><Downloads /></ProtectedRoute>
                  } />
                  <Route path="/research-dashboard" element={
                    <ProtectedRoute allowedRoles={['researcher']}><ResearchDashboard /></ProtectedRoute>
                  } />
                  <Route path="/profile" element={<Profile />} />
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
