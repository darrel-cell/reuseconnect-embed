import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  ArrowLeft, 
  CheckCircle2, 
  Loader2, 
  FileCheck, 
  Package,
  Shield,
  Award,
  PoundSterling,
  Leaf,
  Download,
  AlertCircle,
  XCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useBooking } from "@/hooks/useBookings";
import { useGradingRecords } from "@/hooks/useGrading";
import { useSanitisationRecords } from "@/hooks/useSanitisation";
import { useCompleteBooking } from "@/hooks/useBookings";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const Approval = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: booking, isLoading: isLoadingBooking } = useBooking(id || null);
  const { data: gradingRecords = [] } = useGradingRecords(id);
  const { data: sanitisationRecords = [] } = useSanitisationRecords(id);
  const completeBooking = useCompleteBooking();

  // Check if all assets are graded
  const allAssetsGraded = booking?.assets.every(asset => {
    const gradedQty = gradingRecords
      .filter(r => r.assetId === asset.categoryId)
      .reduce((s, r) => s + (r.quantity || 0), 0);
    return gradedQty >= asset.quantity;
  });

  // Check if all assets are sanitised
  const allAssetsSanitised = booking?.assets.every(asset => {
    return sanitisationRecords.some(record => record.assetId === asset.categoryId);
  });

  // Calculate totals
  const totalResaleValue = gradingRecords.reduce((sum, record) => {
    return sum + (record.resaleValue * (record.quantity || 1));
  }, 0);

  const totalAssets = booking?.assets.reduce((sum, a) => sum + a.quantity, 0) || 0;
  
  // Count unique assets that have been graded/sanitised (not just number of records)
  const uniqueGradedAssets = new Set(gradingRecords.map(r => r.assetId)).size;
  const uniqueSanitisedAssets = new Set(sanitisationRecords.map(r => r.assetId)).size;
  
  // Count unique assets that have ALL their sanitisation records verified
  const verifiedAssetsCount = booking?.assets.filter(asset => {
    const assetRecords = sanitisationRecords.filter(r => r.assetId === asset.categoryId);
    return assetRecords.length > 0 && assetRecords.every(r => r.verified);
  }).length || 0;

  const completionChecklist = [
    {
      id: 'graded',
      label: 'All assets graded',
      completed: allAssetsGraded || false,
      count: `${uniqueGradedAssets}/${booking?.assets.length || 0} assets`,
    },
    {
      id: 'sanitised',
      label: 'All assets sanitised',
      completed: allAssetsSanitised || false,
      count: `${uniqueSanitisedAssets}/${booking?.assets.length || 0} assets`,
    },
    {
      id: 'verified',
      label: 'All sanitisation verified',
      completed: uniqueSanitisedAssets > 0 && verifiedAssetsCount === uniqueSanitisedAssets,
      count: `${verifiedAssetsCount}/${uniqueSanitisedAssets} assets verified`,
    },
  ];

  // Since we're in 'graded' status, all processes should already be completed
  // This is just a verification - all items should be true
  const allProcessesComplete = completionChecklist.every(item => item.completed);

  const handleApprove = () => {
    if (!id) return;

    // Double-check that all processes are complete (should always be true at this stage)
    if (!allProcessesComplete) {
      toast.error("Cannot approve booking", {
        description: "Some required processes appear incomplete. Please verify all steps have been completed.",
      });
      return;
    }

    completeBooking.mutate(id, {
      onSuccess: () => {
        toast.success("Booking approved and completed successfully!", {
          description: "The booking has been marked as completed.",
        });
        navigate("/admin/bookings");
      },
      onError: (error) => {
        toast.error("Failed to complete booking", {
          description: error instanceof Error ? error.message : "Please try again.",
        });
      },
    });
  };

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
          <Link to="/admin/bookings" className="text-inherit no-underline">Back to Booking Queue</Link>
        </Button>
      </div>
    );
  }

  if (booking.status !== 'graded') {
    return (
      <div className="space-y-6">
        <Alert>
          <AlertDescription>
            Final approval can only be performed on graded bookings. Current status: {booking.status}
          </AlertDescription>
        </Alert>
        <Button asChild>
          <Link to="/admin/bookings" className="text-inherit no-underline">Back to Booking Queue</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4"
      >
        <Button variant="ghost" size="icon" asChild>
          <Link to="/admin/bookings" className="text-inherit no-underline">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-foreground">Final Approval</h2>
          <p className="text-muted-foreground">{booking.bookingNumber} - {booking.organisationName || booking.clientName}</p>
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
              </div>
              <Package className="h-8 w-8 text-primary/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Resale Value</p>
                <p className="text-2xl font-bold">£{totalResaleValue.toLocaleString()}</p>
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
                <p className="text-2xl font-bold">{(booking.estimatedCO2e / 1000).toFixed(1)}t</p>
              </div>
              <Leaf className="h-8 w-8 text-success/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Process Verification Summary */}
      <Card className="bg-success/5 border-success/20 border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            Process Verification Summary
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            All required processes have been completed. This booking is ready for final approval.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {completionChecklist.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-background border border-success/10"
            >
              <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-success">
                  {item.label}
                </p>
                <p className="text-sm text-muted-foreground">{item.count}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Grading Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Grading Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {booking.assets.map((asset) => {
              const records = gradingRecords.filter(r => r.assetId === asset.categoryId);
              const totalValue = records.reduce((sum, r) => sum + (r.resaleValue * (r.quantity || 1)), 0);
              
              return (
                <div key={asset.categoryId} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div>
                    <p className="font-medium">{asset.categoryName}</p>
                    <p className="text-sm text-muted-foreground">
                      {asset.quantity} units • {records.length > 0 ? `Graded entries: ${records.length}` : 'Not graded'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">£{totalValue.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Resale value</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Sanitisation Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Sanitisation Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {booking.assets.map((asset) => {
              const records = sanitisationRecords.filter(r => r.assetId === asset.categoryId);
              
              return (
                <div key={asset.categoryId} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div>
                    <p className="font-medium">{asset.categoryName}</p>
                    <p className="text-sm text-muted-foreground">
                      {records.length > 0 
                        ? `Method: ${records[0].method.replace('-', ' ')}`
                        : 'Not sanitised'}
                    </p>
                  </div>
                  <div className="text-right">
                    {records.length > 0 && records[0].verified ? (
                      <Badge className="bg-success/10 text-success">Verified</Badge>
                    ) : (
                      <Badge variant="outline">Pending</Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Approval Actions */}
      <Card className="border-2 border-success/20 bg-success/5">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-success">
              <CheckCircle2 className="h-5 w-5" />
              <p className="font-medium">All requirements met. Ready for final approval.</p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="success"
                size="lg"
                onClick={handleApprove}
                disabled={completeBooking.isPending || !allProcessesComplete}
                className="w-auto"
              >
                {completeBooking.isPending ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Approving...
                  </>
                ) : (
                  <>
                    <FileCheck />
                    Approve & Complete Booking
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="lg"
                asChild
              >
                <Link to={`/bookings/${id}/grading`}>
                  <Download />
                  View Full Report
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Approval;

