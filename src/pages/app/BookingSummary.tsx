import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  ArrowLeft, 
  Loader2, 
  Package,
  PoundSterling,
  Leaf,
  Award,
  Shield,
  FileText,
  Calendar,
  CheckCircle2,
  Truck,
  User,
  Phone,
  Smartphone
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useBooking } from "@/hooks/useBookings";
import { useJob } from "@/hooks/useJobs";
import { useAuth } from "@/contexts/AuthContext";
import { useGradingRecords } from "@/hooks/useGrading";
import { useSanitisationRecords } from "@/hooks/useSanitisation";
import { canDriverEditJob } from "@/utils/job-helpers";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

const BookingSummary = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: booking, isLoading: isLoadingBooking } = useBooking(id || null);
  const { data: relatedJob } = useJob(booking?.jobId || null);
  const { data: gradingRecords = [] } = useGradingRecords(id);
  const { data: sanitisationRecords = [] } = useSanitisationRecords(id);

  if (isLoadingBooking) {
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

  if (booking.status !== 'completed') {
    return (
      <div className="space-y-6">
        <Alert>
          <AlertDescription>
            Completion summary is only available for completed bookings. Current status: {booking.status}
          </AlertDescription>
        </Alert>
        <Button asChild>
          <Link to={`/bookings/${id}`} className="text-inherit no-underline">Back to Booking</Link>
        </Button>
      </div>
    );
  }

  // Calculate totals
  const totalResaleValue = gradingRecords.reduce((sum, record) => {
    const asset = booking.assets.find(a => a.categoryId === record.assetId);
    return sum + (record.resaleValue * (asset?.quantity || 1));
  }, 0);

  const totalAssets = booking.assets.reduce((sum, a) => sum + a.quantity, 0);
  const totalCO2e = booking.estimatedCO2e || 0;

  // Get certificate links (from sanitisation records)
  const certificates = sanitisationRecords.map(record => ({
    id: record.certificateId,
    url: record.certificateUrl,
    asset: booking.assets.find(a => a.categoryId === record.assetId)?.categoryName || 'Unknown',
    method: record.method,
  }));

  // Group grades by asset
  const gradesByAsset = booking.assets.map(asset => {
    const record = gradingRecords.find(r => r.assetId === asset.categoryId);
    return {
      asset,
      grade: record?.grade || null,
      resaleValue: record ? record.resaleValue * asset.quantity : 0,
    };
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
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
            <h2 className="text-2xl font-bold text-foreground">Booking Completion Summary</h2>
            <p className="text-muted-foreground">{booking.bookingNumber} - {booking.organisationName || booking.clientName}</p>
          </div>
        </div>
      </motion.div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Assets</p>
                <p className="text-2xl font-bold">{totalAssets}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {booking.assets.length} categories
                </p>
              </div>
              <Package className="h-8 w-8 text-primary/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Resale Value</p>
                <p className="text-2xl font-bold">£{totalResaleValue.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Final buyback value
                </p>
              </div>
              <PoundSterling className="h-8 w-8 text-success/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">CO₂e Saved</p>
                <p className="text-2xl font-bold">{(totalCO2e / 1000).toFixed(1)}t</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Environmental impact
                </p>
              </div>
              <Leaf className="h-8 w-8 text-success/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Asset Grades Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Asset Grades & Values
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {gradesByAsset.map(({ asset, grade, resaleValue }) => {
              const gradeColors: Record<string, string> = {
                'A': 'bg-success/10 text-success border-success/20',
                'B': 'bg-info/10 text-info border-info/20',
                'C': 'bg-warning/10 text-warning border-warning/20',
                'D': 'bg-destructive/10 text-destructive border-destructive/20',
                'Recycled': 'bg-muted text-muted-foreground border-muted',
              };

              return (
                <div
                  key={asset.categoryId}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="font-medium">{asset.categoryName}</p>
                      <p className="text-sm text-muted-foreground">
                        {asset.quantity} units
                      </p>
                    </div>
                    {grade && (
                      <Badge className={cn("text-sm border", gradeColors[grade])}>
                        Grade {grade}
                      </Badge>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">£{resaleValue.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Resale value</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Certificates */}
      {certificates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Data Sanitisation Certificates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {certificates.map((cert, index) => (
                <div
                  key={cert.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{cert.asset}</p>
                      <p className="text-sm text-muted-foreground">
                        Certificate ID: {cert.id} • Method: {cert.method.replace('-', ' ')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Completion Date */}
      {booking.completedAt && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="font-medium">Booking Completed</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(booking.completedAt).toLocaleString("en-GB", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
              <Badge className="bg-success/10 text-success border-success/20">
                Completed
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle>Related Links</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button variant="outline" asChild>
              <Link to={`/bookings/${id}/grading`} className="text-inherit no-underline">
                <Award className="h-4 w-4 mr-2" />
                View Grading Report
              </Link>
            </Button>
            {certificates.length > 0 && (
              <Button variant="outline" asChild>
                <Link to={`/bookings/${id}/certificates`} className="text-inherit no-underline">
                  <Shield className="h-4 w-4 mr-2" />
                  View Certificates
                </Link>
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link to={`/documents`} className="text-inherit no-underline">
                <FileText className="h-4 w-4 mr-2" />
                View Chain of Custody
              </Link>
            </Button>
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
      </div>
    </div>
  );
};

export default BookingSummary;

