import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Award, PoundSterling, Loader2, FileText, Truck, User, Phone, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useBooking } from "@/hooks/useBookings";
import { useJob } from "@/hooks/useJobs";
import { useAuth } from "@/contexts/AuthContext";
import { useGradingRecords } from "@/hooks/useGrading";
import { canDriverEditJob } from "@/utils/job-helpers";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

const grades: { value: 'A' | 'B' | 'C' | 'D' | 'Recycled'; label: string; color: string }[] = [
  { value: 'A', label: 'Grade A - Excellent', color: 'bg-success/10 text-success' },
  { value: 'B', label: 'Grade B - Good', color: 'bg-info/10 text-info' },
  { value: 'C', label: 'Grade C - Fair', color: 'bg-warning/10 text-warning' },
  { value: 'D', label: 'Grade D - Poor', color: 'bg-destructive/10 text-destructive' },
  { value: 'Recycled', label: 'Recycled', color: 'bg-muted text-muted-foreground' },
];

const BookingGradingReport = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: booking, isLoading: isLoadingBooking } = useBooking(id || null);
  const { data: relatedJob } = useJob(booking?.jobId || null);
  const { data: records = [], isLoading: isLoadingRecords } = useGradingRecords(id);

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
            <h2 className="text-2xl font-bold text-foreground">Asset Grading Report</h2>
            <p className="text-muted-foreground">{booking.bookingNumber} - {booking.organisationName || booking.clientName}</p>
          </div>
        </motion.div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Award className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No job assigned yet</p>
              <p className="text-sm text-muted-foreground mt-2">
                A driver must be assigned to this booking before grading can be performed.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (booking.status !== 'graded' && booking.status !== 'completed') {
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
            <h2 className="text-2xl font-bold text-foreground">Asset Grading Report</h2>
            <p className="text-muted-foreground">{booking.bookingNumber} - {booking.organisationName || booking.clientName}</p>
          </div>
        </motion.div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Award className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Grading report will be available after assets are graded</p>
              <p className="text-sm text-muted-foreground mt-2">
                Current status: <Badge variant="outline" className="ml-1">{booking.status}</Badge>
              </p>
              {((booking.status as any) === 'sanitised' || (booking.status as any) === 'graded') && user?.role === 'admin' && (
                <Button className="mt-4" asChild>
                  <Link to={`/admin/grading/${id}`} className="text-inherit no-underline">
                    Go to Asset Grading
                  </Link>
                </Button>
              )}
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

  const totalResaleValue = records.reduce((sum, r) => {
    const asset = booking.assets.find(a => a.categoryId === r.assetId);
    return sum + (r.resaleValue * (asset?.quantity || 1));
  }, 0);

  const totalAssets = booking.assets.reduce((sum, a) => sum + a.quantity, 0);
  const gradedAssets = records.length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to={`/bookings/${id}`} className="text-inherit no-underline">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Asset Grading Report</h2>
            <p className="text-muted-foreground">{booking.bookingNumber} - {booking.organisationName || booking.clientName}</p>
          </div>
        </div>
      </motion.div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Assets</p>
                <p className="text-2xl font-bold">{totalAssets}</p>
              </div>
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Graded Assets</p>
                <p className="text-2xl font-bold">{gradedAssets}</p>
              </div>
              <Award className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Resale Value</p>
                <p className="text-2xl font-bold">£{totalResaleValue.toLocaleString()}</p>
              </div>
              <PoundSterling className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grading Details */}
      <Card>
        <CardHeader>
          <CardTitle>Asset Grades</CardTitle>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <div className="text-center py-12">
              <Award className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No grading records available</p>
              <p className="text-sm text-muted-foreground mt-2">
                Assets need to be graded through the Asset Grading page.
              </p>
              {user?.role === 'admin' && (
                <Button className="mt-4" asChild>
                  <Link to={`/admin/grading/${id}`} className="text-inherit no-underline">
                    Go to Asset Grading
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {booking.assets.map((asset) => {
                const assetRecord = recordsByAsset[asset.categoryId]?.[0];

                if (!assetRecord) return null;

                const gradeInfo = grades.find(g => g.value === assetRecord.grade);
                const totalValue = assetRecord.resaleValue * asset.quantity;

                return (
                  <div
                    key={asset.categoryId}
                    className="flex items-start justify-between p-4 rounded-lg border bg-muted/50"
                  >
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Award className="h-5 w-5 text-muted-foreground" />
                        <span className="font-semibold">{asset.categoryName}</span>
                        <Badge variant="secondary">{asset.quantity} units</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={cn("text-sm", gradeInfo?.color)}>
                          Grade {assetRecord.grade}
                        </Badge>
                        {assetRecord.condition && (
                          <span className="text-sm text-muted-foreground">
                            {assetRecord.condition}
                          </span>
                        )}
                      </div>
                      <div className="text-sm space-y-1">
                        <p>
                          <span className="text-muted-foreground">Per Unit:</span> <span className="font-medium text-foreground">£{assetRecord.resaleValue.toLocaleString()}</span>
                        </p>
                        <p>
                          <span className="text-muted-foreground">Total Value:</span> <span className="font-semibold text-foreground">£{totalValue.toLocaleString()}</span>
                        </p>
                        <p>
                          <span className="text-muted-foreground">Graded:</span> <span className="text-foreground">{new Date(assetRecord.gradedAt).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}</span>
                        </p>
                        {assetRecord.notes && (
                          <p className="text-xs"><span className="text-muted-foreground">Notes:</span> <span className="text-foreground">{assetRecord.notes}</span></p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
      </div>
    </div>
  );
};

export default BookingGradingReport;

