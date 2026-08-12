import { motion } from "framer-motion";
import { Leaf, TreeDeciduous, Home, Car, Loader2, CheckCircle2, Calendar } from "lucide-react";
import { co2eEquivalencies } from "@/lib/constants";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useDashboardStats } from "@/hooks/useJobs";
import { useAuth } from "@/contexts/auth-context";
import { Badge } from "@/components/ui/badge";

export function CO2eOverview() {
  const { data: stats, isLoading } = useDashboardStats();
  const { user } = useAuth();
  const isClient = user?.role === 'client';
  
  if (isLoading || !stats) {
    return (
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // For clients: show actual vs estimated
  const totalCO2e = stats.totalCO2eSaved;
  const completedCO2e = stats.completedCO2eSaved ?? 0;
  const estimatedCO2e = stats.estimatedCO2eSaved ?? 0;
  const completedCount = stats.completedJobsCount ?? 0;
  const bookedCount = stats.bookedJobsCount ?? 0;
  
  const trees = co2eEquivalencies.treesPlanted(totalCO2e);
  const householdDays = co2eEquivalencies.householdDays(totalCO2e);
  const carMiles = co2eEquivalencies.carMiles(totalCO2e);

  const equivalencies = [
    { icon: TreeDeciduous, value: trees.toLocaleString(), label: "Trees planted equivalent" },
    { icon: Home, value: householdDays.toLocaleString(), label: "Household days offset" },
    { icon: Car, value: carMiles.toLocaleString(), label: "Car miles avoided" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.4 }}
      className="rounded-xl border bg-gradient-hero text-primary-foreground p-6 shadow-lg overflow-hidden relative"
    >
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary-foreground/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary-foreground/5 rounded-full translate-y-1/2 -translate-x-1/2" />
      
      <div className="relative">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-lg bg-primary-foreground/10">
                <Leaf className="h-5 w-5" />
              </div>
              <span className="text-sm font-medium text-primary-foreground/80">Environmental Impact</span>
            </div>
            <p className="text-4xl font-bold">{(totalCO2e / 1000).toFixed(1)}t</p>
            <p className="text-sm text-primary-foreground/70">CO₂e saved (reuse minus travel)</p>
            {isClient && (completedCount > 0 || bookedCount > 0) && (
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-primary-foreground/20">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary-foreground/70" />
                  <span className="text-xs text-primary-foreground/80">
                    {completedCount} completed ({(completedCO2e / 1000).toFixed(1)}t actual)
                  </span>
                </div>
                {bookedCount > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-primary-foreground/70" />
                    <span className="text-xs text-primary-foreground/80">
                      {bookedCount} booked ({(estimatedCO2e / 1000).toFixed(1)}t estimated)
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
          <Button variant="glass" size="sm" asChild className="text-primary-foreground border-primary-foreground/20 hover:bg-primary-foreground/10">
            <Link to="/co2e" className="gap-1 group relative bg-white/10 backdrop-blur-sm text-foreground hover:bg-white/20 hover:border-white/50 hover:shadow-lg hover:shadow-accent/20 transition-all duration-300 ease-out active:scale-[0.98]">
              Full Report <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"/>
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {equivalencies.map((item, index) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.5 + index * 0.1 }}
              className="text-center p-3 rounded-lg bg-primary-foreground/10 backdrop-blur-sm"
            >
              <item.icon className="h-5 w-5 mx-auto mb-2 text-primary-foreground/80" />
              <p className="text-xl font-bold">{item.value}</p>
              <p className="text-xs text-primary-foreground/70 leading-tight">{item.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
