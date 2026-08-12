import { lazy, Suspense } from "react";
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
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { RouteFallback } from "@/components/RouteFallback";

// Eager on purpose: every session enters through the bootstrap, so lazy-loading
// it would add a round trip before the "Opening your portal…" spinner can paint.
import EmbedBootstrap from "./pages/app/EmbedBootstrap";

// Route-level code splitting. Every page used to be a static import, producing a
// single ~1.6 MB chunk that had to download before anything painted inside the
// partner's iframe — including Leaflet, Recharts and framer-motion for users who
// never open a map or a chart.
const Index = lazy(() => import("./pages/app/Index"));
const Jobs = lazy(() => import("./pages/app/Jobs"));
const JobDetail = lazy(() => import("./pages/app/JobDetail"));
const Booking = lazy(() => import("./pages/app/Booking"));
const BookingsHistory = lazy(() => import("./pages/app/BookingsHistory"));
const CO2eDashboard = lazy(() => import("./pages/app/CO2eDashboard"));
const Documents = lazy(() => import("./pages/app/Documents"));
const Sites = lazy(() => import("./pages/app/Sites"));
const BookingDetail = lazy(() => import("./pages/app/BookingDetail"));
const BookingTimeline = lazy(() => import("./pages/app/BookingTimeline"));
const BookingCertificates = lazy(() => import("./pages/app/BookingCertificates"));
const BookingGradingReport = lazy(() => import("./pages/app/BookingGradingReport"));
const BookingSummary = lazy(() => import("./pages/app/BookingSummary"));
const Notifications = lazy(() => import("./pages/app/Notifications"));
const NotFound = lazy(() => import("./pages/app/NotFound"));
const JMLNewStarter = lazy(() => import("./pages/app/JMLNewStarter"));
const JMLLeaver = lazy(() => import("./pages/app/JMLLeaver"));
const JMLBreakfix = lazy(() => import("./pages/app/JMLBreakfix"));
const JMLMover = lazy(() => import("./pages/app/JMLMover"));
const Inventory = lazy(() => import("./pages/app/Inventory"));
const Settings = lazy(() => import("./pages/app/Settings"));
const Profile = lazy(() => import("./pages/app/Profile"));

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
              {/* Without this, an uncaught render error unmounts the tree and the
                  partner's customer is left looking at a blank iframe. */}
              <ErrorBoundary context="embed portal root">
              <Suspense fallback={<RouteFallback />}>
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
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/notifications" element={<Notifications />} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
              </ErrorBoundary>
            </NotificationProvider>
          </TenantThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
