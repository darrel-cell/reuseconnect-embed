import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { TenantThemeProvider } from "@/contexts/TenantThemeContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import EmbedBootstrap from "./pages/app/EmbedBootstrap";
import Index from "./pages/app/Index";
import Jobs from "./pages/app/Jobs";
import JobDetail from "./pages/app/JobDetail";
import Booking from "./pages/app/Booking";
import BookingsHistory from "./pages/app/BookingsHistory";
import CO2eDashboard from "./pages/app/CO2eDashboard";
import Documents from "./pages/app/Documents";
import Settings from "./pages/app/Settings";
import Sites from "./pages/app/Sites";
import BookingDetail from "./pages/app/BookingDetail";
import BookingTimeline from "./pages/app/BookingTimeline";
import BookingCertificates from "./pages/app/BookingCertificates";
import BookingGradingReport from "./pages/app/BookingGradingReport";
import BookingSummary from "./pages/app/BookingSummary";
import Notifications from "./pages/app/Notifications";
import NotFound from "./pages/app/NotFound";
import JMLNewStarter from "./pages/app/JMLNewStarter";
import JMLLeaver from "./pages/app/JMLLeaver";
import JMLBreakfix from "./pages/app/JMLBreakfix";
import JMLMover from "./pages/app/JMLMover";
import Inventory from "./pages/app/Inventory";
const queryClient = new QueryClient();

const ClientOnly = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute allowedRoles={['client']}>{children}</ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <TenantThemeProvider>
            <NotificationProvider>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/p/:slug" element={<EmbedBootstrap />} />

                <Route
                  element={
                    <ClientOnly>
                      <AppLayout />
                    </ClientOnly>
                  }
                >
                  <Route path="/dashboard" element={<Index />} />
                  <Route path="/jobs" element={<Jobs />} />
                  <Route path="/jobs/:id" element={<JobDetail />} />
                  <Route path="/booking" element={<Booking />} />
                  <Route path="/booking/itad" element={<Booking />} />
                  <Route path="/booking/courier" element={<Booking />} />
                  <Route path="/bookings/jml" element={<Booking />} />
                  <Route path="/bookings/jml/new-starter" element={<JMLNewStarter />} />
                  <Route path="/bookings/jml/leaver" element={<JMLLeaver />} />
                  <Route path="/bookings/jml/breakfix" element={<JMLBreakfix />} />
                  <Route path="/bookings/jml/mover" element={<JMLMover />} />
                  <Route path="/bookings" element={<BookingsHistory />} />
                  <Route path="/bookings/:id" element={<BookingDetail />} />
                  <Route path="/bookings/:id/timeline" element={<BookingTimeline />} />
                  <Route path="/bookings/:id/certificates" element={<BookingCertificates />} />
                  <Route path="/bookings/:id/grading" element={<BookingGradingReport />} />
                  <Route path="/bookings/:id/summary" element={<BookingSummary />} />
                  <Route path="/co2e" element={<CO2eDashboard />} />
                  <Route path="/documents" element={<Documents />} />
                  <Route path="/sites" element={<Sites />} />
                  <Route path="/inventory" element={<Inventory />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/notifications" element={<Notifications />} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </NotificationProvider>
          </TenantThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
