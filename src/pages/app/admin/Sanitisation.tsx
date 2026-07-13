import { useState } from "react";
import { motion } from "framer-motion";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Shield, CheckCircle2, Clock, Loader2, Plus, Download, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useBooking, useUpdateBookingStatus } from "@/hooks/useBookings";
import { useSanitisationRecords, useCreateSanitisationRecord, useVerifySanitisation } from "@/hooks/useSanitisation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const sanitisationMethods = [
  { value: 'blancco', label: 'NIST-800-88 Software Wipe' },
  { value: 'physical-destruction', label: 'Physical Destruction' },
  { value: 'degaussing', label: 'Degaussing' },
  { value: 'shredding', label: 'Shredding' },
  { value: 'other', label: 'Other' },
];

const Sanitisation = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isWarehouseTechnician = user?.role === "warehouse_technician";
  const backTo = isWarehouseTechnician ? "/jobs" : "/admin/bookings";
  const { data: booking, isLoading: isLoadingBooking } = useBooking(id || null);
  const { data: records = [], isLoading: isLoadingRecords } = useSanitisationRecords(id);
  const createRecord = useCreateSanitisationRecord();
  const verifyRecord = useVerifySanitisation();
  const updateBookingStatus = useUpdateBookingStatus();

  const [selectedAssetId, setSelectedAssetId] = useState<string>("");
  const [method, setMethod] = useState<string>("");
  const [methodDetails, setMethodDetails] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [showForm, setShowForm] = useState(false);

  const handleCreateRecord = () => {
    if (!id || !selectedAssetId || !method || !user) {
      toast.error("Please fill in all required fields");
      return;
    }

    const asset = booking?.assets.find(a => a.categoryId === selectedAssetId);
    if (!asset) {
      toast.error("Asset not found");
      return;
    }

    createRecord.mutate(
      {
        bookingId: id,
        assetId: selectedAssetId,
        method: method as any,
        performedBy: user.id,
        methodDetails: methodDetails || undefined,
        notes: notes || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Sanitisation record created successfully!", {
            description: "Certificate ID has been generated.",
          });
          setShowForm(false);
          setSelectedAssetId("");
          setMethod("");
          setMethodDetails("");
          setNotes("");
        },
        onError: (error) => {
          toast.error("Failed to create sanitisation record", {
            description: error instanceof Error ? error.message : "Please try again.",
          });
        },
      }
    );
  };

  const handleVerify = (recordId: string) => {
    verifyRecord.mutate(recordId, {
      onSuccess: () => {
        toast.success("Sanitisation verified successfully!");
      },
      onError: (error) => {
        toast.error("Failed to verify sanitisation", {
          description: error instanceof Error ? error.message : "Please try again.",
        });
      },
    });
  };

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
          <Link to={backTo} className="text-inherit no-underline">Back</Link>
        </Button>
      </div>
    );
  }

  if (booking.status !== 'collected' && booking.status !== 'warehouse' && booking.status !== 'sanitised' && booking.status !== 'graded' && booking.status !== 'completed') {
    return (
      <div className="space-y-6">
        <Alert>
          <AlertDescription>
            Sanitisation can only be performed on collected or warehouse bookings. Current status: {booking.status}
          </AlertDescription>
        </Alert>
        <Button asChild>
          <Link to={backTo} className="text-inherit no-underline">Back</Link>
        </Button>
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

  // Check if all assets are sanitised and verified
  const allAssetsSanitised = booking?.assets.every(asset => {
    const assetRecords = recordsByAsset[asset.categoryId] || [];
    return assetRecords.length > 0 && assetRecords.every(r => r.verified);
  });

  const handleMoveToNextStatus = () => {
    if (!id || !booking) return;
    
    // Update status if moving from 'collected' or 'warehouse' to 'sanitised'
    // Do NOT update to 'graded' - that should only happen after actual grading is completed
    if (booking.status === 'collected' || booking.status === 'warehouse') {
      // Update to 'sanitised' status
      updateBookingStatus.mutate(
        { bookingId: id, status: 'sanitised' },
        {
          onSuccess: () => {
            // Invalidate booking queries to refresh data
            if (id) {
              queryClient.invalidateQueries({ queryKey: ['bookings', id] });
            }
            queryClient.invalidateQueries({ queryKey: ['bookings'] });
            
            toast.success("Booking moved to sanitised status", {
              description: "All assets have been sanitised and verified. Proceeding to grading.",
            });
            navigate(`/admin/grading/${id}`);
          },
          onError: (error) => {
            toast.error("Failed to update booking status", {
              description: error instanceof Error ? error.message : "Please try again.",
            });
          },
        }
      );
    } else if (booking.status === 'sanitised') {
      // Just navigate to grading page - do NOT update status to 'graded'
      // Status will remain 'sanitised' until grading is actually completed
      toast.success("Navigating to grading page", {
        description: "All assets have been sanitised and verified. Complete grading to proceed.",
      });
      navigate(`/admin/grading/${id}`);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center gap-4"
      >
        <div className="flex items-center gap-4 flex-1">
        <Button variant="ghost" size="icon" asChild>
          <Link to={backTo} className="text-inherit no-underline">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-foreground">Sanitisation Management</h2>
          <p className="text-muted-foreground">{booking.bookingNumber} - {booking.organisationName || booking.clientName}</p>
          </div>
        </div>
        {!showForm && (
          <Button variant="default" onClick={() => setShowForm(true)} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Record Sanitisation
          </Button>
        )}
      </motion.div>

      {/* Create Record Form */}
      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Record Sanitisation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="asset">Asset Category</Label>
                <Select value={selectedAssetId} onValueChange={setSelectedAssetId}>
                  <SelectTrigger id="asset">
                    <SelectValue placeholder="Select asset category..." />
                  </SelectTrigger>
                  <SelectContent>
                    {booking.assets.map((asset) => (
                      <SelectItem key={asset.categoryId} value={asset.categoryId}>
                        {asset.categoryName} ({asset.quantity} units)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="method">Sanitisation Method *</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger id="method">
                    <SelectValue placeholder="Select method..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sanitisationMethods.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {method === 'other' && (
                <div className="space-y-2">
                  <Label htmlFor="details">Method Details *</Label>
                  <Input
                    id="details"
                    value={methodDetails}
                    onChange={(e) => setMethodDetails(e.target.value)}
                    placeholder="Describe the sanitisation method..."
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes about the sanitisation..."
                  rows={3}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="default"
                  onClick={handleCreateRecord}
                  disabled={!selectedAssetId || !method || createRecord.isPending}
                >
                  {createRecord.isPending ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Shield />
                      Create Record
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Sanitisation Records */}
      <div className="space-y-4">
        {booking.assets.map((asset) => {
          const assetRecords = recordsByAsset[asset.categoryId] || [];

          return (
            <Card key={asset.categoryId}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{asset.categoryName}</CardTitle>
                  <Badge variant="secondary">{asset.quantity} units</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {assetRecords.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No sanitisation records for this asset
                  </p>
                ) : (
                  <div className="space-y-3">
                    {assetRecords.map((record) => (
                      <div
                        key={record.id}
                        className="flex items-start justify-between p-4 rounded-lg border bg-muted/50"
                      >
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-muted-foreground" />
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
                            <p><span className="text-muted-foreground">Certificate ID:</span> <span className="font-mono text-foreground">{record.certificateId}</span></p>
                            <p>
                              <span className="text-muted-foreground">Performed:</span> <span className="text-foreground">{new Date(record.timestamp).toLocaleString("en-GB")}</span>
                            </p>
                            {record.methodDetails && (
                              <p><span className="text-muted-foreground">Details:</span> <span className="text-foreground">{record.methodDetails}</span></p>
                            )}
                            {record.notes && (
                              <p><span className="text-muted-foreground">Notes:</span> <span className="text-foreground">{record.notes}</span></p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          {!record.verified && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleVerify(record.id)}
                              disabled={verifyRecord.isPending}
                            >
                              Verify
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Approval Button */}
      {allAssetsSanitised && (booking.status === 'collected' || booking.status === 'warehouse') && (
        <Card className="bg-success/5 border-success/20 border-2">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="font-medium mb-1">All assets sanitised and verified</p>
                <p className="text-sm text-muted-foreground">
                  Ready to move to sanitised status
                </p>
              </div>
              <Button 
                variant="success" 
                size="lg"
                onClick={handleMoveToNextStatus}
                disabled={updateBookingStatus.isPending}
                className="w-full sm:w-auto"
              >
                {updateBookingStatus.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Approve & Continue
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      {allAssetsSanitised && booking.status === 'sanitised' && (
        <Card className="bg-success/5 border-success/20 border-2">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium mb-1">All assets sanitised and verified</p>
                <p className="text-sm text-muted-foreground">
                  Ready to proceed to grading stage
                </p>
              </div>
              <Button 
                variant="success" 
                size="lg"
                onClick={handleMoveToNextStatus}
                disabled={updateBookingStatus.isPending}
              >
                {updateBookingStatus.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Approve & Move to Grading
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Sanitisation;

