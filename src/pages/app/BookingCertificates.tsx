import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Shield, CheckCircle2, Clock, Loader2, FileText, Truck, User, Phone, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useBooking } from "@/hooks/useBookings";
import { useJob } from "@/hooks/useJobs";
import { useAuth } from "@/contexts/AuthContext";
import { useSanitisationRecords } from "@/hooks/useSanitisation";
import { canDriverEditJob } from "@/utils/job-helpers";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

const sanitisationMethods = [
  { value: 'blancco', label: 'Blancco Software Wipe' },
  { value: 'physical-destruction', label: 'Physical Destruction' },
  { value: 'degaussing', label: 'Degaussing' },
  { value: 'shredding', label: 'Shredding' },
  { value: 'other', label: 'Other' },
];

const BookingCertificates = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: booking, isLoading: isLoadingBooking } = useBooking(id || null);
  const { data: relatedJob } = useJob(booking?.jobId || null);
  const { data: records = [], isLoading: isLoadingRecords } = useSanitisationRecords(id);

  if (isLoadingBooking || isLoadingRecords) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!booking) {
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

  if (booking.status === 'created' || booking.status === 'scheduled') {
    return (
      <div className="space-y-6">
        <Alert>
          <AlertDescription>
            Sanitisation certificates will be available after assets are collected and sanitised.
            Current status: {booking.status}
          </AlertDescription>
        </Alert>
        <Button asChild>
          <Link to={`/bookings/${id}`} className="text-inherit no-underline">Back to Booking</Link>
        </Button>
      </div>
    );
  }

  // Check if job exists
  if (!booking.jobId && !relatedJob) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
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
            <h2 className="text-2xl font-bold text-foreground">Sanitisation Certificates</h2>
            <p className="text-muted-foreground">{booking.bookingNumber} - {booking.organisationName || booking.clientName}</p>
          </div>
        </motion.div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Shield className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No job assigned yet</p>
              <p className="text-sm text-muted-foreground mt-2">
                A driver must be assigned to this booking before certificates can be generated.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Group records by asset
  const recordsByAsset = records.reduce((acc, record) => {
    if (!acc[record.assetId]) {
      acc[record.assetId] = [];
    }
    acc[record.assetId].push(record);
    return acc;
  }, {} as Record<string, typeof records>);

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
          <h2 className="text-2xl font-bold text-foreground">Sanitisation Certificates</h2>
          <p className="text-muted-foreground">{booking.bookingNumber} - {booking.clientName}</p>
        </div>
      </motion.div>

      {/* Certificates List */}
      {records.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Shield className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No sanitisation certificates available yet</p>
              <p className="text-sm text-muted-foreground mt-2">
                {booking.status === 'collected' || booking.status === 'sanitised' || booking.status === 'graded' || booking.status === 'completed'
                  ? "Assets need to be sanitised through the Sanitisation Management page."
                  : "Certificates will appear here once assets are collected and sanitised."}
              </p>
              {(booking.status === 'collected' || booking.status === 'sanitised') && user?.role === 'admin' && (
                <Button className="mt-4" asChild>
                  <Link to={`/admin/sanitisation/${id}`} className="text-inherit no-underline">
                    Go to Sanitisation Management
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {booking.assets.map((asset) => {
            const assetRecords = recordsByAsset[asset.categoryId] || [];

            if (assetRecords.length === 0) return null;

            return (
              <Card key={asset.categoryId}>
                <CardHeader>
                  <CardTitle className="text-lg">{asset.categoryName}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {assetRecords.map((record) => (
                      <div
                        key={record.id}
                        className="flex items-start justify-between p-4 rounded-lg border bg-muted/50"
                      >
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <Shield className="h-5 w-5 text-primary" />
                            <span className="font-medium">
                              {sanitisationMethods.find(m => m.value === record.method)?.label || record.method}
                            </span>
                            {record.verified ? (
                              <Badge className="bg-success/10 text-success">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Verified
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                <Clock className="h-3 w-3 mr-1" />
                                Pending Verification
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm space-y-1">
                            <p>
                              <span className="text-muted-foreground">Certificate ID:</span> <span className="font-mono font-medium text-foreground">{record.certificateId}</span>
                            </p>
                            <p>
                              <span className="text-muted-foreground">Sanitised:</span> <span className="text-foreground">{new Date(record.timestamp).toLocaleString("en-GB", {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}</span>
                            </p>
                            {record.methodDetails && (
                              <p><span className="text-muted-foreground">Method Details:</span> <span className="text-foreground">{record.methodDetails}</span></p>
                            )}
                            {record.notes && (
                              <p className="text-xs"><span className="text-muted-foreground">Notes:</span> <span className="text-foreground">{record.notes}</span></p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

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
      </div>

      {/* Info Card */}
      <Card className="bg-info/5 border-info/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-info mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-foreground mb-1">About Certificates</p>
              <p className="text-sm text-muted-foreground">
                Sanitisation certificates provide proof that data has been securely erased from your assets.
                These certificates are important for compliance and can be used for audit purposes.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BookingCertificates;

