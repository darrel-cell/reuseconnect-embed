import { motion } from "framer-motion";
import { Truck, Package, PoundSterling, Leaf, Loader2 } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { RecentJobsTable } from "@/components/dashboard/RecentJobsTable";
import { CO2eOverview } from "@/components/dashboard/CO2eOverview";
import { TravelEmissionsBox } from "@/components/dashboard/TravelEmissionsBox";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/auth-context";
import { useDashboardStats } from "@/hooks/useJobs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { log } from '@/lib/log';

const Index = () => {
  const { user } = useAuth();
  const canCreateBooking = user && ['admin', 'client'].includes(user.role);
  const welcomeName = user?.name || 'User';
  
  const { data: stats, isLoading, error } = useDashboardStats();

  // Show error but don't block the page - allow partial rendering
  if (error) {
    log.error('Dashboard stats error:', error);
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h2 className="text-2xl font-bold text-foreground">Welcome back, {welcomeName}</h2>
          <p className="text-muted-foreground">
            {user?.role === 'admin' && "Here's what's happening with your ITAD operations"}
            {user?.role === 'client' && "Track your asset collections and environmental impact"}
            {user?.role === 'partner' && "Track ITAD process status for your clients and monitor outcomes"}
            {user?.role === 'driver' && "View your assigned routes and collection jobs"}
            {!user && "Welcome to the ITAD Platform"}
          </p>
        </div>
        {canCreateBooking && (
          <Button variant="default" size="lg" asChild>
            <Link to="/booking/itad" className="text-inherit no-underline">
              <Plus />
              New Booking
            </Link>
          </Button>
        )}
      </motion.div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load dashboard data. Showing cached data or empty state.
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border bg-card p-6 shadow-sm">
              <div className="flex items-center justify-center h-24">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            </div>
          ))}
        </div>
      ) : stats ? (
        <div className={`grid gap-4 ${user?.role === 'driver' ? 'sm:grid-cols-1 lg:grid-cols-1' : 'sm:grid-cols-2 lg:grid-cols-4'}`}>
          <StatCard
            title="Active Jobs"
            value={
              user?.role === 'client' && typeof stats.bookedJobsCount === 'number'
                ? stats.bookedJobsCount
                : stats.activeJobs
            }
            subtitle="In progress"
            icon={Truck}
            variant="primary"
            delay={0}
          />
          {user?.role !== 'driver' && (
            <>
              <StatCard
                title="Total Assets"
                value={stats.totalAssets.toLocaleString()}
                subtitle="Processed"
                icon={Package}
                delay={0.1}
              />
              <StatCard
                title="Buyback Value"
                value={`£${stats.totalBuyback.toLocaleString()}`}
                subtitle="Total recovered"
                icon={PoundSterling}
                variant="accent"
                delay={0.2}
              />
              <StatCard
                title="CO₂e Saved"
                value={`${(stats.totalCO2eSaved / 1000).toFixed(1)}t`}
                subtitle="Environmental impact"
                icon={Leaf}
                variant="success"
                delay={0.3}
              />
            </>
          )}
        </div>
      ) : null}

      {/* Main Content Grid */}
      <div className={`grid gap-6 ${user?.role === 'driver' ? 'lg:grid-cols-5' : 'lg:grid-cols-5'}`}>
        {user?.role === 'driver' ? (
          <>
            <div className="lg:col-span-3">
              <RecentJobsTable />
            </div>
            <div className="lg:col-span-2">
              <TravelEmissionsBox />
            </div>
          </>
        ) : (
          <>
            <div className="lg:col-span-3">
              <RecentJobsTable />
            </div>
            <div className="lg:col-span-2 space-y-6">
              <CO2eOverview />
              <TravelEmissionsBox />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Index;

