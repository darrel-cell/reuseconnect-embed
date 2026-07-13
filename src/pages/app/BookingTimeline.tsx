import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, Clock, Calendar, MapPin, Package, Truck, Shield, Award, FileCheck, User, Phone, Smartphone, Warehouse, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useBooking } from "@/hooks/useBookings";
import { useJob } from "@/hooks/useJobs";
import { useAuth } from "@/contexts/AuthContext";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { canDriverEditJob } from "@/utils/job-helpers";
import { Loader2 } from "lucide-react";
import { getStatusLabelExtended, getStatusColor, getSanitisedTimelineStep } from "@/types/booking-lifecycle";
import type { BookingLifecycleStatus } from "@/types/booking-lifecycle";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

// Helper function to get timeline steps based on booking type
function getTimelineSteps(
  bookingType?: 'itad_collection' | 'free_collection' | 'jml',
  jmlSubType?: 'new_starter' | 'leaver' | 'breakfix' | 'mover' | null
): { status: BookingLifecycleStatus | 'cancelled'; label: string; icon: typeof CheckCircle2; description: string }[] {
  // ITAD workflow
  if (!bookingType || bookingType === 'itad_collection') {
    const sanitisedStep = getSanitisedTimelineStep(bookingType);
    return [
      { status: 'created', label: 'Created', icon: Package, description: 'Booking request created' },
      { status: 'scheduled', label: 'Scheduled', icon: Calendar, description: 'Driver assigned and scheduled' },
      { status: 'collected', label: 'Collected', icon: Truck, description: 'Assets collected by driver' },
      { status: 'warehouse', label: 'At Warehouse', icon: Warehouse, description: 'Assets delivered to warehouse' },
      { status: 'sanitised', label: sanitisedStep.label, icon: Shield, description: sanitisedStep.description },
      { status: 'graded', label: 'Graded', icon: Award, description: 'Assets graded for resale' },
      { status: 'completed', label: 'Completed', icon: FileCheck, description: 'Booking completed' },
    ];
  }

  // JML workflows
  if (bookingType === 'free_collection') {
    return [
      { status: 'created', label: 'Created', icon: Package, description: 'Booking request created' },
      { status: 'collection_scheduled', label: 'Collection Scheduled', icon: Calendar, description: 'Courier collection scheduled' },
      { status: 'collected', label: 'Collected', icon: Truck, description: 'Devices collected by courier from employee' },
      { status: 'warehouse', label: 'At Warehouse', icon: Warehouse, description: 'Devices delivered to warehouse' },
      { status: 'sanitised', label: 'Sanitised', icon: Shield, description: 'Data sanitisation completed' },
      { status: 'graded', label: 'Graded', icon: Award, description: 'Devices graded' },
      { status: 'inventory', label: 'Inventory', icon: Package, description: 'Devices added to inventory for reuse' },
      { status: 'completed', label: 'Completed', icon: FileCheck, description: 'Booking completed' },
    ];
  }

  // JML workflows
  if (bookingType === 'jml') {
    if (jmlSubType === 'new_starter') {
      return [
        { status: 'created', label: 'Created', icon: Package, description: 'Booking request created' },
        { status: 'device_allocated', label: 'Device Allocated', icon: Package, description: 'Items picked, packed, and serial numbers allocated' },
        { status: 'courier_booked', label: 'Courier Booked', icon: Calendar, description: 'Courier booked and tracking number inputted' },
        { status: 'dispatched', label: 'Dispatched', icon: Truck, description: 'Courier picked up package' },
        { status: 'delivered', label: 'Delivered', icon: CheckCircle2, description: 'Package arrived at new user and received' },
        { status: 'completed', label: 'Completed', icon: FileCheck, description: 'ERP and connected shake hands, ticket closed' },
      ];
    } else if (jmlSubType === 'leaver') {
      return [
        { status: 'created', label: 'Created', icon: Package, description: 'Booking request created' },
        { status: 'collection_scheduled', label: 'Collection Scheduled', icon: Calendar, description: 'Courier collection scheduled' },
        { status: 'collected', label: 'Collected', icon: Truck, description: 'Devices collected by courier from employee' },
        { status: 'warehouse', label: 'At Warehouse', icon: Warehouse, description: 'Devices delivered to warehouse' },
        { status: 'sanitised', label: 'Sanitised', icon: Shield, description: 'Data sanitisation completed' },
        { status: 'graded', label: 'Graded', icon: Award, description: 'Devices graded' },
        { status: 'inventory', label: 'Inventory', icon: Package, description: 'Devices added to inventory for reuse' },
        { status: 'completed', label: 'Completed', icon: FileCheck, description: 'Booking completed' },
      ];
    } else if (jmlSubType === 'mover') {
      // Mover: Leaver first (collect old), then New Starter (deliver new)
      return [
        { status: 'created', label: 'Created', icon: Package, description: 'Booking request created' },
        { status: 'collection_scheduled', label: 'Collection Scheduled', icon: Calendar, description: 'Courier collection scheduled' },
        { status: 'collected', label: 'Collected', icon: Truck, description: 'Devices collected by courier from old location' },
        { status: 'warehouse', label: 'At Warehouse', icon: Warehouse, description: 'Devices at warehouse' },
        { status: 'graded', label: 'Graded', icon: Award, description: 'Devices graded' },
        { status: 'inventory', label: 'Inventory', icon: Package, description: 'Devices added to inventory' },
        { status: 'device_allocated', label: 'Device Allocated', icon: Package, description: 'Device allocated from inventory' },
        { status: 'courier_booked', label: 'Courier Booked', icon: Calendar, description: 'Device courier booked' },
        { status: 'dispatched', label: 'Dispatched', icon: Truck, description: 'Courier picked up device' },
        { status: 'delivered', label: 'Delivered', icon: CheckCircle2, description: 'Device delivered to new location' },
        { status: 'completed', label: 'Completed', icon: FileCheck, description: 'Booking completed' },
      ];
    } else if (jmlSubType === 'breakfix') {
      // Breakfix: New Starter first (deliver replacement), then Leaver (collect broken)
      return [
        { status: 'created', label: 'Created', icon: Package, description: 'Booking request created' },
        { status: 'device_allocated', label: 'Replacement Allocated', icon: Package, description: 'Replacement device allocated from inventory' },
        { status: 'courier_booked', label: 'Courier Booked', icon: Calendar, description: 'Replacement device courier booked' },
        { status: 'dispatched', label: 'Dispatched', icon: Truck, description: 'Courier picked up replacement device' },
        { status: 'delivered', label: 'Replacement Delivered', icon: CheckCircle2, description: 'Replacement device delivered' },
        { status: 'collected', label: 'Broken Device Collected', icon: Truck, description: 'Broken device collected by courier' },
        { status: 'warehouse', label: 'At Warehouse', icon: Warehouse, description: 'Broken device at warehouse' },
        { status: 'sanitised', label: 'Sanitised', icon: Shield, description: 'Data sanitisation completed' },
        { status: 'graded', label: 'Graded', icon: Award, description: 'Broken device graded' },
         { status: 'inventory', label: 'Inventory', icon: Package, description: 'Broken device added to inventory' },
        { status: 'completed', label: 'Completed', icon: FileCheck, description: 'Booking completed' },
      ];
    }
  }

  // Default to ITAD if unknown
  const sanitisedStep = getSanitisedTimelineStep(bookingType);
  return [
    { status: 'created', label: 'Created', icon: Package, description: 'Booking request created' },
    { status: 'scheduled', label: 'Scheduled', icon: Calendar, description: 'Driver assigned and scheduled' },
    { status: 'collected', label: 'Collected', icon: Truck, description: 'Assets collected by driver' },
    { status: 'warehouse', label: 'At Warehouse', icon: Warehouse, description: 'Assets delivered to warehouse' },
    { status: 'sanitised', label: sanitisedStep.label, icon: Shield, description: sanitisedStep.description },
    { status: 'graded', label: 'Graded', icon: Award, description: 'Assets graded for resale' },
    { status: 'completed', label: 'Completed', icon: FileCheck, description: 'Booking completed' },
  ];
}

const BookingTimeline = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: booking, isLoading, error } = useBooking(id || null);
  const { data: relatedJob } = useJob(booking?.jobId || null);
  const timelineSteps = useMemo(
    () => (booking ? getTimelineSteps(booking.bookingType, booking.jmlSubType) : []),
    [booking?.bookingType, booking?.jmlSubType]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertDescription>Booking not found</AlertDescription>
        </Alert>
        <Button asChild>
          <Link to="/bookings" className="text-inherit no-underline">Back to Bookings</Link>
        </Button>
      </div>
    );
  }

  const currentStatusIndex = timelineSteps.findIndex(step => step.status === booking.status);
  const isCancelled = booking.status === 'cancelled';

  const getTimestamp = (status: BookingLifecycleStatus | 'cancelled') => {
    switch (status) {
      case 'created': return booking.createdAt;
      case 'scheduled': return booking.scheduledAt;
      case 'collected': return booking.collectedAt;
      case 'warehouse': return undefined; // warehouseAt field doesn't exist in schema
      case 'sanitised': return booking.sanitisedAt;
      case 'graded': return booking.gradedAt;
      case 'delivered': return booking.deliveryDate;
      case 'completed': return booking.completedAt;
      case 'inventory': return undefined; // No specific timestamp field
      case 'device_allocated': return undefined; // No specific timestamp field
      case 'courier_booked': return undefined; // No specific timestamp field
      case 'dispatched': return undefined; // No specific timestamp field
      case 'collection_scheduled': return booking.scheduledAt; // Re-use scheduledAt for collection scheduling
      case 'cancelled': return undefined;
      default: return undefined;
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4"
      >
        <Button variant="ghost" size="icon" asChild>
          <Link to={`/bookings/${id}`} className="text-inherit no-underline">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-foreground">Booking Timeline</h2>
          <p className="text-muted-foreground">{booking.bookingNumber} - {booking.organisationName || booking.clientName}</p>
        </div>
      </motion.div>

      {/* Timeline */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            {/* Timeline Line */}
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />

            {/* Timeline Steps */}
            <div className="space-y-8">
              {timelineSteps.map((step, index) => {
                const isCompleted = !isCancelled && currentStatusIndex >= index;
                const isCurrent = !isCancelled && currentStatusIndex === index;
                const timestamp = getTimestamp(step.status);
                const Icon = step.icon;
                const statusColor = isCompleted || isCurrent
                  ? getStatusColor(step.status)
                  : 'text-muted-foreground bg-muted';

                return (
                  <motion.div
                    key={step.status}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="relative flex items-start gap-4"
                  >
                    {/* Icon */}
                    <div className={cn(
                      "relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all",
                      isCompleted || isCurrent
                        ? "border-primary bg-primary/10"
                        : "border-muted bg-muted"
                    )}>
                      {isCompleted ? (
                        <CheckCircle2 className={cn("h-6 w-6", isCompleted ? "text-primary" : "text-muted-foreground")} />
                      ) : (
                        <Icon className={cn("h-6 w-6", isCurrent ? "text-primary" : "text-muted-foreground")} />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 pt-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground">{step.label}</h3>
                        {isCurrent && (
                          <Badge variant="secondary" className="bg-primary/10 text-primary">
                            Current
                          </Badge>
                        )}
                        {isCompleted && (
                          <Badge variant="outline" className="bg-success/10 text-success">
                            Completed
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{step.description}</p>
                      {timestamp && (
                        <p className="text-xs text-muted-foreground">
                          {new Date(timestamp).toLocaleString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      )}
                      {isCurrent && !timestamp && (
                        <p className="text-xs text-warning">Pending</p>
                      )}
                      {!isCompleted && !isCurrent && (
                        <p className="text-xs text-muted-foreground">Not started</p>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {isCancelled && (
              <div className="mt-8 pt-8 border-t">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-destructive bg-destructive/10">
                    <Clock className="h-6 w-6 text-destructive" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-destructive">Cancelled</h3>
                    <p className="text-sm text-muted-foreground">This booking has been cancelled</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Booking Information */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Round Trip Mileage */}
        {booking.roundTripDistanceKm && booking.roundTripDistanceKm > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Round Trip Mileage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Truck className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">
                    {booking.roundTripDistanceMiles?.toFixed(1) || (booking.roundTripDistanceKm * 0.621371).toFixed(1)} miles
                  </p>
                  <p className="text-sm text-muted-foreground">
                    ({booking.roundTripDistanceKm.toFixed(1)} km)
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    From collection site to warehouse and return
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Driver Information */}
        {relatedJob?.driver && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Driver Assignment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-muted-foreground">Driver Details</p>
                  {user?.role === 'driver' && canDriverEditJob(relatedJob) && relatedJob.id && (
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/driver/jobs/${relatedJob.id}`} className="text-inherit no-underline">
                          <Smartphone className="h-4 w-4 mr-2" />
                          Driver View
                        </Link>
                      </Button>
                    )}
                </div>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{relatedJob.driver.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono">{relatedJob.driver.vehicleReg}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{relatedJob.driver.phone}</span>
                  </div>
                  {relatedJob.driver.vehicleType && (
                    <Badge variant="outline" className="text-xs">
                      {relatedJob.driver.vehicleType}
                      {relatedJob.driver.vehicleFuelType && ` • ${relatedJob.driver.vehicleFuelType}`}
                    </Badge>
                  )}
                  {(relatedJob.status === "routed" || relatedJob.status === "en-route") && (
                    <Badge 
                      variant="secondary" 
                      className={relatedJob.driver.isEtaDelayed 
                        ? "bg-destructive/20 text-destructive border-destructive/50" 
                        : "bg-warning/20 text-warning-foreground"
                      }
                    >
                      ETA: {relatedJob.driver.eta || "--:--"}
                      {relatedJob.driver.isEtaDelayed && " (Delayed)"}
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {booking.driverName && !relatedJob?.driver && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Truck className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Assigned Driver</p>
                  <p className="font-medium">{booking.driverName}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default BookingTimeline;

