import { motion } from "framer-motion";
import { Truck, Fuel, Zap, MapPin, Loader2 } from "lucide-react";
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

  const { petrol, diesel, electric, totalDistanceKm, totalDistanceMiles } = stats.travelEmissions;

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

          {/* Vehicle Emissions */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg border bg-background">
              <div className="flex items-center gap-2 mb-2">
                <Fuel className="h-4 w-4 text-orange-500" />
                <span className="text-xs font-semibold text-muted-foreground">Petrol</span>
              </div>
              <p className="text-xl font-bold text-foreground">
                {petrol.toFixed(1)}kg
              </p>
              <p className="text-xs text-muted-foreground mt-1">CO₂e</p>
            </div>
            <div className="p-3 rounded-lg border bg-background">
              <div className="flex items-center gap-2 mb-2">
                <Fuel className="h-4 w-4 text-blue-500" />
                <span className="text-xs font-semibold text-muted-foreground">Diesel</span>
              </div>
              <p className="text-xl font-bold text-foreground">
                {diesel.toFixed(1)}kg
              </p>
              <p className="text-xs text-muted-foreground mt-1">CO₂e</p>
            </div>
            <div className="p-3 rounded-lg border bg-background">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-green-500" />
                <span className="text-xs font-semibold text-muted-foreground">Electric</span>
              </div>
              <p className="text-xl font-bold text-success">
                {electric.toFixed(1)}kg
              </p>
              <p className="text-xs text-muted-foreground mt-1">CO₂e</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

