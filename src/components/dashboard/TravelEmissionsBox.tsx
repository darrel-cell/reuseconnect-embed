import { motion } from "framer-motion";
import { Truck, Fuel, MapPin, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardStats } from "@/hooks/useJobs";
import { kmToMiles } from "@/lib/calculations";

export function TravelEmissionsBox() {
  const { data: stats, isLoading } = useDashboardStats();
  
  if (isLoading || !stats?.travelEmissions) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Travel Emissions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // The per-fuel split this card used to show was fabricated: the backend took
  // the single recorded emissions total and multiplied it by (0.21 / 0.24) and
  // (0.19 / 0.24), i.e. it assumed every job used a van and then presented the
  // rescaled numbers as if petrol and diesel fleets had each done the work. It
  // now reports the emissions actually recorded against the jobs.
  const { total, totalDistanceKm, totalDistanceMiles } = stats.travelEmissions;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.5 }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            Travel Emissions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Total Distance */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Total Mileage</span>
            </div>
            <span className="text-lg font-bold">
              {totalDistanceMiles.toFixed(1)} miles ({totalDistanceKm.toFixed(1)} km)
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            Round trip from collection sites to warehouse (RM13 8BT)
          </div>

          {/* Recorded collection travel emissions */}
          <div className="p-3 rounded-lg border bg-background">
            <div className="flex items-center gap-2 mb-2">
              <Fuel className="h-4 w-4 text-orange-500" />
              <span className="text-xs font-semibold text-muted-foreground">
                Collection travel emissions
              </span>
            </div>
            <p className="text-2xl font-bold text-foreground">{total.toFixed(1)}kg</p>
            <p className="text-xs text-muted-foreground mt-1">
              CO₂e, from each job&apos;s actual vehicle and distance
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

