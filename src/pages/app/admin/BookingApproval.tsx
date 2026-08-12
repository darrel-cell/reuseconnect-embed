import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import type { ParsedJmlDevice } from "@/lib/jml-booking-device-details";
import { motion } from "framer-motion";
import { 
  ArrowLeft, 
  CheckCircle2, 
  Loader2, 
  FileCheck,
  Package,
  XCircle,
  MapPin,
  Calendar,
  PoundSterling,
  Leaf,
  AlertCircle,
  Shield,
  Award,
  Download,
  Truck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/booking/DatePicker";
import { BuybackEstimateDisclaimer } from "@/components/booking/BuybackEstimateDisclaimer";
import { useBooking, useApproveBooking, useUpdateBookingStatus, useCompleteBooking, useCheckJobIdUnique } from "@/hooks/useBookings";
import { useGradingRecords } from "@/hooks/useGrading";
import { useSanitisationRecords } from "@/hooks/useSanitisation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { inventoryService } from "@/services/inventory.service";
import { getUnderlyingAssetCategoryNameForJml, isAccessoriesCategory } from "@/lib/jml-assets";

/** Match JML device line category (e.g. "Phone") to client inventory row category (e.g. "Smart Phones"). */
function jmlInventoryCategoryMatchesDevice(deviceCategory: string, inventoryCategory: string): boolean {
  const a = (deviceCategory || "").trim().toLowerCase();
  const b = (inventoryCategory || "").trim().toLowerCase();
  if (!a || !b) return false;
  if (a === b) return true;
  const ua = getUnderlyingAssetCategoryNameForJml(deviceCategory.trim());
  const ub = getUnderlyingAssetCategoryNameForJml(inventoryCategory.trim());
  if (ua && ub && ua.toLowerCase() === ub.toLowerCase()) return true;
  if (ua && b === ua.toLowerCase()) return true;
  if (ub && a === ub.toLowerCase()) return true;
  return false;
}

/** Show Windows/Apple (etc.) badge for laptop, desktop, and phone categories when deviceType is set. */
function jmlDeviceShowsTypeBadge(device: { category?: string; deviceType?: string }): boolean {
  if (!device?.deviceType) return false;
  const c = String(device.category || "").toLowerCase().trim();
  return c === "laptop" || c === "desktop" || c.includes("phone");
}

function toLocalDateInputValue(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
const FREE_COURIER_MAX_ITEMS = 5;

function isFreeCourierBooking(booking?: {
  bookingType?: "itad_collection" | "free_collection" | "jml" | null;
  assets?: Array<{ categoryName?: string; quantity: number }>;
} | null): boolean {
  if (!booking) return false;
  if (booking.bookingType === "free_collection") return true;
  if (booking.bookingType && booking.bookingType !== "itad_collection") return false;

  const assets = booking.assets || [];
  if (assets.length === 0) return false;

  const totalUnits = assets.reduce((sum, asset) => sum + (asset.quantity || 0), 0);
  if (totalUnits <= 0 || totalUnits > FREE_COURIER_MAX_ITEMS) return false;

  return assets.every((asset) => {
    const categoryName = (asset.categoryName || "").toLowerCase();
    return categoryName.includes("phone") || categoryName.includes("laptop");
  });
}

const BookingApproval = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: booking, isLoading: isLoadingBooking } = useBooking(id || null);
  const { data: gradingRecords = [] } = useGradingRecords(id);
  const { data: sanitisationRecords = [] } = useSanitisationRecords(id);
  const approveBooking = useApproveBooking();
  const cancelBooking = useUpdateBookingStatus();
  const completeBooking = useCompleteBooking();
  const checkJobIdUnique = useCheckJobIdUnique();
  const [approvalNotes, setApprovalNotes] = useState("");
  const [erpJobNumber, setErpJobNumber] = useState("");
  const [approvedCollectionCost, setApprovedCollectionCost] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [cancellationNotes, setCancellationNotes] = useState("");
  const [showCancelForm, setShowCancelForm] = useState(false);
  
  const isGraded = booking?.status === 'graded';
  const isInventory = booking?.status === 'inventory';
  const isPending = booking?.status === 'pending';
  const isPostGrading = isGraded || isInventory;
  const isLeaverOrBreakfixOrMover =
    booking?.bookingType === 'jml' &&
    (booking?.jmlSubType === 'leaver' ||
      booking?.jmlSubType === 'breakfix' ||
      booking?.jmlSubType === 'mover');
  const isJmlMover = booking?.bookingType === 'jml' && booking?.jmlSubType === 'mover';
  // Leaver/breakfix/mover collection leg: must reach inventory before complete from this page (graded → inventory → …).
  // Mover at inventory continues to device allocation (not completed from this page).
  const isDeliveredNewStarter = booking?.bookingType === 'jml' && booking?.jmlSubType === 'new_starter' && booking?.status === 'delivered';
  const isDeliveredMover = booking?.bookingType === 'jml' && booking?.jmlSubType === 'mover' && booking?.status === 'delivered';
  /** JML bookings that use this page after delivery, before completed (final overview). */
  const isDeliveredJmlFinalReview = isDeliveredNewStarter || isDeliveredMover;
  const canCompleteFromThisPage =
    (isGraded && !isLeaverOrBreakfixOrMover) ||
    (isInventory && !isJmlMover) ||
    isDeliveredJmlFinalReview;

  // Keep URL consistent:
  // - pending approval should be on /admin/booking-approval/:id
  // - final review should be on /booking-review/:id
  // When status becomes completed (or cancelled), do not sync to pending URL — that used to race with
  // navigate to the queue and left users on /admin/booking-approval/:id with "already been completed".
  const shouldRedirectToFinalReview = isGraded || isInventory || isDeliveredJmlFinalReview;
  const bookingQueuePath = "/admin/bookings";
  const isFreeCollectionBooking = useMemo(() => isFreeCourierBooking(booking), [booking]);

  useEffect(() => {
    if (!booking || !id) return;

    if (booking.status === "completed" || booking.status === "cancelled") {
      if (location.pathname !== bookingQueuePath) {
        navigate(bookingQueuePath, { replace: true });
      }
      return;
    }

    const pendingPath = `/admin/booking-approval/${id}`;
    const finalPath = `/booking-review/${id}`;

    if (shouldRedirectToFinalReview) {
      if (location.pathname !== finalPath) {
        navigate(finalPath, { replace: true });
      }
    } else {
      if (location.pathname !== pendingPath) {
        navigate(pendingPath, { replace: true });
      }
    }
  }, [booking, id, location.pathname, navigate, shouldRedirectToFinalReview]);

  useEffect(() => {
    if (!booking?.scheduledDate) return;
    setScheduledDate(toLocalDateInputValue(booking.scheduledDate));
  }, [booking?.scheduledDate]);

  const { data: clientInventory = [], isLoading: isLoadingClientInventory } = useQuery({
    queryKey: ['inventory', booking?.clientId, 'delivered-jml-final', booking?.jmlSubType],
    queryFn: () =>
      booking?.clientId ? inventoryService.getInventory(booking.clientId) : Promise.resolve([]),
    enabled: isDeliveredJmlFinalReview && !!booking?.clientId,
    staleTime: 30000,
  });

  const deliveredSerialNumbers = useMemo(() => {
    const history = booking?.statusHistory;
    if (!history?.length) return [];

    const serials = new Set<string>();
    for (const h of history) {
      const notes = (h?.notes || '').toString();

      // Example: "Allocated 2 device(s): SN1, SN2"
      const multiMatch = notes.match(/Allocated \d+ device\(s\):\s*(.+)$/i);
      if (multiMatch?.[1]) {
        multiMatch[1].split(',').forEach((s) => {
          const v = s.trim();
          if (v) serials.add(v);
        });
      }

      // Mover bulk link: "Devices auto-allocated: SN1, SN2"
      const autoAlloc = notes.match(/Devices auto-allocated:\s*([^\n.]+)/i);
      if (autoAlloc?.[1]) {
        autoAlloc[1].split(',').forEach((s) => {
          const v = s.trim();
          if (v) serials.add(v);
        });
      }

      // Example: "Device allocated: SN1"
      const singleMatch = notes.match(/Device allocated:\s*(.+)$/i);
      if (singleMatch?.[1]) {
        const v = singleMatch[1].trim();
        if (v) serials.add(v);
      }
    }

    return Array.from(serials);
  }, [booking?.statusHistory]);

  const deliveredInventoryItems = useMemo(() => {
    if (!deliveredSerialNumbers.length) return [];
    const serialSet = new Set(deliveredSerialNumbers);
    return clientInventory.filter((i) => serialSet.has(i.serialNumber));
  }, [clientInventory, deliveredSerialNumbers]);

  const totalAssets = useMemo(() => {
    if (!booking) return 0;
    if (isDeliveredJmlFinalReview) {
      return deliveredSerialNumbers.length;
    }
    if (isPostGrading && gradingRecords.length > 0) {
      return gradingRecords.reduce((sum, r) => {
        const grade = String(r.grade || "").toUpperCase();
        if (grade === "Q") return sum;
        return sum + (Number(r.quantity) || 0);
      }, 0);
    }
    return booking.assets.reduce((sum, a) => sum + a.quantity, 0);
  }, [booking, isDeliveredJmlFinalReview, deliveredSerialNumbers.length, isPostGrading, gradingRecords]);

  const handleApprove = async () => {
    if (!id) return;

    if (!erpJobNumber.trim()) {
      toast.error("Job ID is required", {
        description: "Please enter a unique Job ID before approving the booking.",
      });
      return;
    }

    const approvedCollectionCostValue = Number(approvedCollectionCost);
    if (!isFreeCollectionBooking) {
      if (!Number.isFinite(approvedCollectionCostValue) || approvedCollectionCostValue < 0) {
        toast.error("Collection cost is required", {
          description: "Please enter a valid non-negative collection cost before approving.",
        });
        return;
      }
    }

    if (!scheduledDate) {
      toast.error("Scheduled date is required", {
        description: "Please select a collection date before approving the booking.",
      });
      return;
    }

    // Check if Job ID is unique before approving
    try {
      const result = await checkJobIdUnique.mutateAsync({
        bookingId: id,
        erpJobNumber: erpJobNumber.trim(),
      });

      if (!result.isUnique) {
        toast.error("Duplicate Job ID", {
          description: `Job ID "${erpJobNumber.trim()}" already exists. Please enter a unique Job ID.`,
        });
        return;
      }

      // Job ID is unique, proceed with approval
      approveBooking.mutate(
        {
          bookingId: id,
          erpJobNumber: erpJobNumber.trim(),
          notes: approvalNotes || undefined,
          collectionCost: isFreeCollectionBooking ? 0 : approvedCollectionCostValue,
          scheduledDate,
        },
        {
          onSuccess: () => {
            toast.success("Booking approved successfully!", {
              description: "The booking has been approved and is now active.",
            });
            navigate(bookingQueuePath, { replace: true });
          },
          onError: (error) => {
            toast.error("Failed to approve booking", {
              description: error instanceof Error ? error.message : "Please try again.",
            });
          },
        }
      );
    } catch (error) {
      toast.error("Failed to check Job ID", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  };

  const handleCancel = () => {
    if (!id) return;

    if (!cancellationNotes.trim()) {
      toast.error("Cancellation reason required", {
        description: "Please provide a reason for cancelling this booking.",
      });
      return;
    }

    cancelBooking.mutate(
      { bookingId: id, status: 'cancelled', notes: cancellationNotes },
      {
        onSuccess: () => {
          toast.success("Booking cancelled", {
            description: "The booking has been cancelled.",
          });
          navigate(bookingQueuePath, { replace: true });
        },
        onError: (error) => {
          toast.error("Failed to cancel booking", {
            description: error instanceof Error ? error.message : "Please try again.",
          });
        },
      }
    );
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
          <Link to={bookingQueuePath} className="text-inherit no-underline">Back to Booking Queue</Link>
        </Button>
      </div>
    );
  }

  // Terminal states: useEffect redirects to the booking queue; show spinner so we don't flash "already completed"
  if (booking.status === "completed" || booking.status === "cancelled") {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Allow: pending, graded, inventory, or JML delivered (new starter / mover) for final overview → completed
  if (!isPending && !isGraded && !isInventory && !isDeliveredJmlFinalReview) {
    const statusMessages: Record<string, { message: string; variant: 'default' | 'destructive' }> = {
      'created': {
        message: 'This booking has already been approved and is now active.',
        variant: 'default',
      },
      'scheduled': {
        message: 'This booking has been scheduled and assigned to a driver.',
        variant: 'default',
      },
    };

    const statusInfo = statusMessages[booking.status] || {
      message: `This booking is in "${booking.status}" status and cannot be approved from this page.`,
      variant: 'default' as const,
    };

    return (
      <div className="space-y-6">
        <Alert variant={statusInfo.variant}>
          <AlertDescription>
            {statusInfo.message}
          </AlertDescription>
        </Alert>
        <Button asChild>
          <Link to={bookingQueuePath} className="text-inherit no-underline">Back to Booking Queue</Link>
        </Button>
      </div>
    );
  }
  
  // For graded/inventory bookings, calculate completion data
  const showFinalReviewChrome = isPostGrading || isDeliveredJmlFinalReview;
  const allAssetsGraded = isPostGrading ? booking?.assets.every(asset => {
    const gradedQty = gradingRecords
      .filter(r => r.assetId === asset.categoryId)
      .reduce((s, r) => s + (r.quantity || 0), 0);
    return gradedQty >= asset.quantity;
  }) : false;
  
  const allAssetsSanitised = isPostGrading ? booking?.assets.every(asset => {
    return sanitisationRecords.some(record => record.assetId === asset.categoryId);
  }) : false;
  
  const totalResaleValue = isPostGrading ? gradingRecords.reduce((sum, record) => {
    return sum + (record.resaleValue * (record.quantity || 1));
  }, 0) : 0;
  
  const uniqueGradedAssets = isPostGrading ? new Set(gradingRecords.map(r => r.assetId)).size : 0;
  const uniqueSanitisedAssets = isPostGrading ? new Set(sanitisationRecords.map(r => r.assetId)).size : 0;

  const inventoryAddingRequired = isLeaverOrBreakfixOrMover;
  const inventoryAdded = inventoryAddingRequired ? isInventory : true;

  const completionChecklist = isPostGrading ? [
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
      id: 'inventory_added',
      label: 'Inventory adding',
      completed: inventoryAdded,
      count: inventoryAddingRequired ? (isInventory ? 'Added' : 'Pending') : 'Not required',
    },
  ] : [];
  
  const allProcessesComplete = isPostGrading ? completionChecklist.every(item => item.completed) : true;
  
  const handleComplete = () => {
    if (!id) return;
    
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
        navigate(bookingQueuePath, { replace: true });
      },
      onError: (error) => {
        toast.error("Failed to complete booking", {
          description: error instanceof Error ? error.message : "Please try again.",
        });
      },
    });
  };

  // Summary card previously displayed only reuse savings (estimatedCO2e).
  // For accessory-only bookings, reuse savings is 0 by business rule, but travel emissions still exists.
  // Show net CO2e instead: reuseSavings - travelEmissions.
  const preferredVehicleType = booking.preferredVehicleType || "petrol";
  const emissionsPerKm =
    preferredVehicleType === "electric" ? 0 : preferredVehicleType === "diesel" ? 0.19 : 0.21; // kg CO2e per km
  const travelEmissionsKg =
    booking.roundTripDistanceKm && booking.roundTripDistanceKm > 0 ? booking.roundTripDistanceKm * emissionsPerKm : 0;
  const netCO2eKg = (booking.estimatedCO2e || 0) - travelEmissionsKg;

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
        <div className="flex-1 min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">
            {showFinalReviewChrome ? 'Final Review' : 'Booking Approval'}
          </h2>
          <div className="text-sm sm:text-base text-muted-foreground">
            <span>{booking.bookingNumber}</span>
          </div>
        </div>
        <Badge className={cn(
          showFinalReviewChrome ? "bg-success/10 text-success" : "bg-warning/10 text-warning",
          "text-xs sm:text-sm px-2 sm:px-3 py-1 flex-shrink-0 whitespace-nowrap"
        )}>
          <span className="hidden sm:inline">
          {showFinalReviewChrome ? 'Ready for Final Review' : 'Pending Approval'}
          </span>
          <span className="sm:hidden">
            {showFinalReviewChrome ? 'Ready' : 'Pending'}
          </span>
        </Badge>
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
                <p className="text-sm text-muted-foreground">
                  {isPostGrading ? 'Resale Value' : 'Estimated Buyback'}
                </p>
                <p className="text-2xl font-bold">
                  {isFreeCollectionBooking
                    ? "-"
                    : `£${isPostGrading ? totalResaleValue.toLocaleString() : booking.estimatedBuyback.toLocaleString()}`}
                </p>
                {!isPostGrading && !isFreeCollectionBooking && (
                  <BuybackEstimateDisclaimer className="mt-2 max-w-xs" />
                )}
              </div>
              <PoundSterling className="h-8 w-8 text-success/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Estimated Net CO₂e</p>
                <p className="text-2xl font-bold">
                  {netCO2eKg === 0
                    ? "0.0t"
                    : `${netCO2eKg < 0 ? "-" : ""}${(Math.abs(netCO2eKg) / 1000).toFixed(1)}t`}
                </p>
              </div>
              <Leaf className="h-8 w-8 text-success/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Booking Details */}
      <Card>
        <CardHeader>
          <CardTitle>Booking Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="font-medium text-muted-foreground text-sm">Organisation</p>
              <p className="font-semibold">{booking.organisationName || booking.clientName}</p>
            </div>
            {booking.createdByName && (
              <div>
                <p className="font-medium text-muted-foreground text-sm">Booked by</p>
                <p>{booking.createdByName}</p>
              </div>
            )}
            {booking.jmlSubType === 'mover' && booking.currentAddress ? (
              isDeliveredJmlFinalReview ? (
                <>
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">Site (Collection)</p>
                      <p className="text-muted-foreground">{booking.currentSiteName || 'Previous location'}</p>
                      <p className="text-muted-foreground text-xs">{booking.currentAddress}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 text-sm pt-1 border-t border-border/60">
                    <MapPin className="h-4 w-4 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium">Site (Delivery)</p>
                      <p className="text-muted-foreground">{booking.siteName}</p>
                      <p className="text-muted-foreground text-xs">{booking.siteAddress}</p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">From (Collection)</p>
                      <p className="text-muted-foreground">{booking.currentSiteName || 'Current Address'}</p>
                      <p className="text-muted-foreground text-xs">{booking.currentAddress}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium">To (Delivery)</p>
                      <p className="text-muted-foreground">{booking.siteName}</p>
                      <p className="text-muted-foreground text-xs">{booking.siteAddress}</p>
                    </div>
                  </div>
                </>
              )
            ) : (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">Site</p>
                  <p className="text-muted-foreground">{booking.siteName}</p>
                  <p className="text-muted-foreground text-xs">{booking.siteAddress}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">Scheduled Date</p>
                <p className="text-muted-foreground">
                  {new Date(booking.scheduledDate).toLocaleDateString("en-GB", { timeZone: UK_TIME_ZONE,
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>
          </div>

          {booking.roundTripDistanceKm && booking.roundTripDistanceKm > 0 && (
            <div className="flex items-center gap-2 text-sm pt-2 border-t">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">Return Journey Mileage</p>
                <p className="text-muted-foreground">
                  {booking.roundTripDistanceMiles 
                    ? `${booking.roundTripDistanceMiles.toFixed(1)} miles (${booking.roundTripDistanceKm.toFixed(1)} km)`
                    : `${(booking.roundTripDistanceKm * 0.621371).toFixed(1)} miles (${booking.roundTripDistanceKm.toFixed(1)} km)`}
                </p>
                <p className="text-muted-foreground text-xs mt-1">
                  From collection site to warehouse and return
                </p>
              </div>
            </div>
          )}

          {!isFreeCollectionBooking && booking.charityPercent > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <p className="font-medium">Charity Donation:</p>
              <Badge variant="outline">{booking.charityPercent}%</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Process Verification Summary - Only for graded bookings */}
      {isPostGrading && (
        <Card className="bg-success/5 border-success/20 border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              Process Verification Summary
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              {allProcessesComplete
                ? "All required processes have been completed. This booking is ready for final approval."
                : "Some required processes are still pending. Please review the checklist below."}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {completionChecklist.map((item) => (
              <div
                key={item.id}
                className={
                  item.completed
                    ? "flex items-center gap-3 p-3 rounded-lg bg-background border border-success/10"
                    : "flex items-center gap-3 p-3 rounded-lg bg-background border border-muted/40 opacity-95"
                }
              >
                {item.completed ? (
                  <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                )}
                <div className="flex-1">
                  <p className={item.completed ? "font-medium text-success" : "font-medium text-muted-foreground"}>
                    {item.label}
                  </p>
                  <p className="text-sm text-muted-foreground">{item.count}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Grading Summary - Only for graded bookings */}
      {isPostGrading && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Grading Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {booking.assets.map((asset) => {
                const records = gradingRecords.filter((r) => r.assetId === asset.categoryId);
                const assetTotalValue = records.reduce((sum, r) => sum + (r.resaleValue * (r.quantity || 1)), 0);

                const gradeColor = (grade?: string) => {
                  const g = (grade || '').toUpperCase();
                  if (g === 'A') return 'bg-success/10 text-success';
                  if (g === 'B') return 'bg-info/10 text-info';
                  if (g === 'C') return 'bg-warning/10 text-warning';
                  if (g === 'D') return 'bg-destructive/10 text-destructive';
                  if (g === 'Q' || g === 'RECYCLED') return 'bg-muted text-muted-foreground';
                  return 'bg-secondary text-secondary-foreground';
                };

                return (
                  <div key={asset.categoryId} className="rounded-lg border bg-muted/20">
                    <div className="flex items-start justify-between gap-4 p-4">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{asset.categoryName}</p>
                        <p className="text-sm text-muted-foreground">
                          {asset.quantity} units
                          {records.length > 0 ? (
                            <> • {records.length} grade entr{records.length === 1 ? 'y' : 'ies'}</>
                          ) : (
                            <> • No grading records</>
                          )}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-semibold">£{assetTotalValue.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Total resale</p>
                      </div>
                    </div>

                    {records.length > 0 ? (
                      <div className="border-t bg-background/60 p-4 space-y-3">
                        {records.map((r) => {
                          const qty = r.quantity || 1;
                          const total = r.resaleValue * qty;
                          const serialCount = r.serialNumbers?.length || 0;
                          const serialPreview = (r.serialNumbers || []).slice(0, 3).join(", ");

                          return (
                            <div key={r.id} className="p-3 rounded-lg border bg-background">
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge className={cn("text-xs", gradeColor(r.grade))}>
                                      Grade {r.grade}
                                    </Badge>
                                    <Badge variant="outline" className="text-xs">
                                      Qty {qty}
                                    </Badge>
                                    {r.condition ? (
                                      <Badge variant="secondary" className="text-xs">
                                        {r.condition}
                                      </Badge>
                                    ) : null}
                                    {serialCount > 0 ? (
                                      <Badge variant="outline" className="text-xs">
                                        Serials {serialCount}
                                      </Badge>
                                    ) : null}
                                  </div>

                                  <div className="text-xs text-muted-foreground space-y-0.5">
                                    <p>
                                      <span className="font-medium text-foreground">£{r.resaleValue.toLocaleString()}</span>{" "}
                                      per unit • <span className="font-medium text-foreground">£{total.toLocaleString()}</span>{" "}
                                      total
                                    </p>
                                    {r.gradedAt ? (
                                      <p>Graded: {new Date(r.gradedAt).toLocaleString("en-GB")}</p>
                                    ) : null}
                                    {serialCount > 0 ? (
                                      <p className="font-mono break-words">
                                        Serials: {serialPreview}
                                        {serialCount > 3 ? ` … (+${serialCount - 3})` : ""}
                                      </p>
                                    ) : null}
                                    {r.notes ? (
                                      <p className="whitespace-pre-wrap break-words">Notes: {r.notes}</p>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sanitisation Summary - Mover skips sanitised status */}
      {isPostGrading && booking?.jmlSubType !== 'mover' && (
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
      )}

      {/* Device Details - For JML bookings */}
      {/* New starter / mover: this page after `delivered` for final overview → completed. */}
      {booking.bookingType === 'jml' &&
        booking.statusHistory &&
        booking.statusHistory.length > 0 &&
        (isPending || isDeliveredJmlFinalReview) && (() => {
        // Extract device details from status history notes
        const creationHistory = booking.statusHistory.find(h => 
          h.notes && h.notes.includes('Device details:')
        );
        
        if (creationHistory && creationHistory.notes) {
          try {
            const isBreakfix = booking.jmlSubType === 'breakfix';

            const brokenMatch = creationHistory.notes.match(/Device details:\s*(\[.*?\])/);
            const replacementMatch = creationHistory.notes.match(/Replacement Device details:\s*(\[.*?\])/i);

            const brokenDeviceDetails = brokenMatch ? JSON.parse(brokenMatch[1]) : [];
            const replacementDeviceDetails = replacementMatch ? JSON.parse(replacementMatch[1]) : [];

            // For breakfix we show both: replacement requirements + broken devices.
            // For other JML subtypes we preserve the existing behaviour.
            if (brokenDeviceDetails.length === 0 && replacementDeviceDetails.length === 0) return null;

            return (
              <Card>
                <CardHeader>
                  <CardTitle>
                    {isDeliveredJmlFinalReview
                      ? 'Device Details'
                      : isBreakfix
                        ? 'Device Details (Replacement & Broken)'
                        : 'Device Details'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isBreakfix ? (
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <p className="text-sm font-medium text-muted-foreground">Replacement Device Requirements</p>
                        {replacementDeviceDetails.length > 0 ? (
                          <div className="space-y-3">
                            {replacementDeviceDetails.map((device: ParsedJmlDevice, index: number) => {
                              const matchingItems = isDeliveredJmlFinalReview
                                ? deliveredInventoryItems.filter((i) =>
                                    jmlInventoryCategoryMatchesDevice(String(device?.category || ""), String(i?.category || ""))
                                  )
                                : [];
                              const deviceSerials = matchingItems.map((i) => i.serialNumber).filter(Boolean);
                              const deviceConditionCodes = Array.from(
                                new Set(matchingItems.map((i) => i.conditionCode).filter(Boolean))
                              );

                              return (
                                <div key={index} className="p-3 rounded-lg bg-muted/30 border">
                                  <div className="grid gap-2">
                                    <div className="flex items-center justify-between">
                                      <p className="font-medium">{device.category}</p>
                                      {jmlDeviceShowsTypeBadge(device) ? (
                                        <Badge variant="outline">{device.deviceType}</Badge>
                                      ) : null}
                                    </div>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                      {isAccessoriesCategory(String(device?.category || "")) ? (
                                        <div>
                                          <span className="font-medium">Accessory info (Note):</span>{" "}
                                          {device?.notes ? String(device.notes) : "-"}
                                        </div>
                                      ) : (
                                        <>
                                          <div>
                                            <span className="font-medium">Make:</span> {device.make}
                                          </div>
                                          <div>
                                            <span className="font-medium">Model:</span> {device.model}
                                          </div>
                                        </>
                                      )}
                                      <div>
                                        <span className="font-medium">Quantity:</span> {device.quantity}
                                      </div>
                                    </div>

                                    {isDeliveredJmlFinalReview && (
                                      <div className="space-y-1">
                                        <p className="text-sm text-muted-foreground">
                                          <span className="font-medium">Serials:</span>{" "}
                                          {isLoadingClientInventory ? (
                                            "Loading..."
                                          ) : deviceSerials.length > 0 ? (
                                            <span className="font-mono">{deviceSerials.join(", ")}</span>
                                          ) : (
                                            "-"
                                          )}
                                        </p>
                                        {!isAccessoriesCategory(String(device?.category || "")) && (
                                          <p className="text-sm text-muted-foreground">
                                            <span className="font-medium">Condition Codes:</span>{" "}
                                            {isLoadingClientInventory ? (
                                              "Loading..."
                                            ) : deviceConditionCodes.length > 0 ? (
                                              <span className="font-mono">{deviceConditionCodes.join(", ")}</span>
                                            ) : (
                                              "-"
                                            )}
                                          </p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No replacement device requirements found.</p>
                        )}
                      </div>

                      <div className="space-y-3">
                        <p className="text-sm font-medium text-muted-foreground">Broken/Damaged Devices</p>
                        {brokenDeviceDetails.length > 0 ? (
                          <div className="space-y-3">
                            {brokenDeviceDetails.map((device: ParsedJmlDevice, index: number) => {
                              const matchingItems = isDeliveredJmlFinalReview
                                ? deliveredInventoryItems.filter((i) =>
                                    jmlInventoryCategoryMatchesDevice(String(device?.category || ""), String(i?.category || ""))
                                  )
                                : [];
                              const deviceSerials = matchingItems.map((i) => i.serialNumber).filter(Boolean);
                              const deviceConditionCodes = Array.from(
                                new Set(matchingItems.map((i) => i.conditionCode).filter(Boolean))
                              );

                              return (
                                <div key={index} className="p-3 rounded-lg bg-muted/30 border">
                                  <div className="grid gap-2">
                                    <div className="flex items-center justify-between">
                                      <p className="font-medium">{device.category}</p>
                                      {jmlDeviceShowsTypeBadge(device) ? (
                                        <Badge variant="outline">{device.deviceType}</Badge>
                                      ) : null}
                                    </div>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                      {isAccessoriesCategory(String(device?.category || "")) ? (
                                        <div>
                                          <span className="font-medium">Accessory info (Note):</span>{" "}
                                          {device?.notes ? String(device.notes) : "-"}
                                        </div>
                                      ) : (
                                        <>
                                          <div>
                                            <span className="font-medium">Make:</span> {device.make}
                                          </div>
                                          <div>
                                            <span className="font-medium">Model:</span> {device.model}
                                          </div>
                                        </>
                                      )}
                                      <div>
                                        <span className="font-medium">Quantity:</span> {device.quantity}
                                      </div>
                                    </div>

                                    {isDeliveredJmlFinalReview && (
                                      <div className="space-y-1">
                                        <p className="text-sm text-muted-foreground">
                                          <span className="font-medium">Serials:</span>{" "}
                                          {isLoadingClientInventory ? (
                                            "Loading..."
                                          ) : deviceSerials.length > 0 ? (
                                            <span className="font-mono">{deviceSerials.join(", ")}</span>
                                          ) : (
                                            "-"
                                          )}
                                        </p>
                                        {!isAccessoriesCategory(String(device?.category || "")) && (
                                          <p className="text-sm text-muted-foreground">
                                            <span className="font-medium">Condition Codes:</span>{" "}
                                            {isLoadingClientInventory ? (
                                              "Loading..."
                                            ) : deviceConditionCodes.length > 0 ? (
                                              <span className="font-mono">{deviceConditionCodes.join(", ")}</span>
                                            ) : (
                                              "-"
                                            )}
                                          </p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No broken device details found.</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {brokenDeviceDetails.map((device: ParsedJmlDevice, index: number) => {
                        const matchingItems = isDeliveredJmlFinalReview
                          ? deliveredInventoryItems.filter((i) =>
                              jmlInventoryCategoryMatchesDevice(String(device?.category || ""), String(i?.category || ""))
                            )
                          : [];
                        const deviceSerials = matchingItems.map((i) => i.serialNumber).filter(Boolean);
                        const deviceConditionCodes = Array.from(
                          new Set(matchingItems.map((i) => i.conditionCode).filter(Boolean))
                        );

                        return (
                          <div key={index} className="p-3 rounded-lg bg-muted/30 border">
                            <div className="grid gap-2">
                              <div className="flex items-center justify-between">
                                <p className="font-medium">{device.category}</p>
                                {jmlDeviceShowsTypeBadge(device) ? (
                                  <Badge variant="outline">{device.deviceType}</Badge>
                                ) : null}
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                {isAccessoriesCategory(String(device?.category || "")) ? (
                                  <div>
                                    <span className="font-medium">Accessory info (Note):</span>{" "}
                                    {device?.notes ? String(device.notes) : "-"}
                                  </div>
                                ) : (
                                  <>
                                    <div>
                                      <span className="font-medium">Make:</span> {device.make}
                                    </div>
                                    <div>
                                      <span className="font-medium">Model:</span> {device.model}
                                    </div>
                                  </>
                                )}
                                <div>
                                  <span className="font-medium">Quantity:</span> {device.quantity}
                                </div>
                              </div>

                              {isDeliveredJmlFinalReview && (
                                <div className="space-y-1">
                                  <p className="text-sm text-muted-foreground">
                                    <span className="font-medium">Serials:</span>{" "}
                                    {isLoadingClientInventory ? (
                                      "Loading..."
                                    ) : deviceSerials.length > 0 ? (
                                      <span className="font-mono">{deviceSerials.join(", ")}</span>
                                    ) : (
                                      "-"
                                    )}
                                  </p>
                                  {!isAccessoriesCategory(String(device?.category || "")) && (
                                    <p className="text-sm text-muted-foreground">
                                      <span className="font-medium">Condition Codes:</span>{" "}
                                      {isLoadingClientInventory ? (
                                        "Loading..."
                                      ) : deviceConditionCodes.length > 0 ? (
                                        <span className="font-mono">{deviceConditionCodes.join(", ")}</span>
                                      ) : (
                                        "-"
                                      )}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          } catch (error) {
            // If parsing fails, don't show device details
          }
        }
        return null;
      })()}

      {/* Approval Actions */}
      {!showCancelForm ? (
        <Card
          className={
            (isPostGrading && allProcessesComplete) || isDeliveredJmlFinalReview
              ? "border-2 border-success/20 bg-success/5"
              : "border-2 border-warning/20 bg-warning/5"
          }
        >
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div
                className={`flex items-center gap-2 ${((isPostGrading && allProcessesComplete) || isDeliveredJmlFinalReview) ? "text-success" : "text-warning"}`}
              >
                {((isPostGrading && allProcessesComplete) || isDeliveredJmlFinalReview) ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <AlertCircle className="h-5 w-5" />
                )}
                <p className="font-medium">
                  {(isPostGrading && allProcessesComplete) || isDeliveredJmlFinalReview
                    ? 'All requirements met. Ready for final approval.'
                    : 'Review booking details before approval'}
                </p>
              </div>
              
              {isPending && (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="erp-job-number" className="text-sm font-medium">
                        Job ID <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="erp-job-number"
                        placeholder="Enter unique Job ID from ERP system"
                        value={erpJobNumber}
                        onChange={(e) => setErpJobNumber(e.target.value)}
                        required
                        className="font-mono"
                      />
                    </div>
                    {!isFreeCollectionBooking && (
                      <div className="space-y-2">
                        <Label htmlFor="approved-collection-cost" className="text-sm font-medium">
                          Collection Cost (£) <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="approved-collection-cost"
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={approvedCollectionCost}
                          onChange={(e) => setApprovedCollectionCost(e.target.value)}
                          required
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="scheduled-date" className="text-sm font-medium">
                        Collection Date <span className="text-destructive">*</span>
                      </Label>
                      <DatePicker
                        date={scheduledDate ? new Date(`${scheduledDate}T00:00:00`) : undefined}
                        onDateChange={(date) => {
                          if (!date) {
                            setScheduledDate("");
                            return;
                          }
                          setScheduledDate(toLocalDateInputValue(date));
                        }}
                        placeholder="Select collection date"
                      />
                      <p className="text-xs text-muted-foreground">
                        Changing this updates the schedule date.
                      </p>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {isFreeCollectionBooking
                      ? "Enter the unique Job ID from ERP and confirm the collection date."
                      : "Enter the unique Job ID from ERP, confirm the collection date, and set collection cost."}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="approval-notes" className="text-sm font-medium">
                      Approval Notes (Optional)
                    </Label>
                    <Textarea
                      id="approval-notes"
                      placeholder="Add any notes about this approval..."
                      value={approvalNotes}
                      onChange={(e) => setApprovalNotes(e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 justify-end">
                {isPostGrading || isDeliveredJmlFinalReview ? (
                  canCompleteFromThisPage ? (
                    <>
                      <Button
                        variant="success"
                        size="lg"
                        onClick={handleComplete}
                        disabled={completeBooking.isPending || !allProcessesComplete}
                        className="w-full sm:w-auto"
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
                      {isPostGrading && (
                        <Button
                          variant="outline"
                          size="lg"
                          asChild
                          className="w-full sm:w-auto"
                        >
                          <Link to={`/bookings/${id}/grading`}>
                            <Download />
                            View Full Report
                          </Link>
                        </Button>
                      )}
                    </>
                  ) : (
                    <>
                      <Alert className="sm:col-span-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Add devices to inventory before completing. Go to the Add to Inventory List page, upload the devices, then return here for final approval.
                        </AlertDescription>
                      </Alert>
                      <Button variant="default" size="lg" asChild className="w-full sm:w-auto">
                        <Link to={`/admin/booking-inventory/${id}`}>Add to Inventory List</Link>
                      </Button>
                    </>
                  )
                ) : (
                  <>
                    <Button
                      variant="success"
                      size="lg"
                      onClick={handleApprove}
                      disabled={approveBooking.isPending || checkJobIdUnique.isPending || !erpJobNumber.trim() || !scheduledDate}
                      className="w-full sm:w-auto"
                    >
                      {checkJobIdUnique.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Checking...
                        </>
                      ) : approveBooking.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Approving...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Approve Booking
                        </>
                      )}
                    </Button>
                    <Button
                      variant="destructive"
                      size="lg"
                      onClick={() => setShowCancelForm(true)}
                      disabled={approveBooking.isPending}
                      className="w-full sm:w-auto"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Cancel Booking
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : isPending ? (
        <Card className="border-2 border-destructive/20 bg-destructive/5">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <p className="font-medium">Cancel Booking</p>
              </div>
              
              <Alert variant="destructive">
                <AlertDescription>
                  Are you sure you want to cancel this booking? This action cannot be undone.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <label htmlFor="cancellation-notes" className="text-sm font-medium">
                  Cancellation Reason <span className="text-destructive">*</span>
                </label>
                <Textarea
                  id="cancellation-notes"
                  placeholder="Please provide a reason for cancelling this booking..."
                  value={cancellationNotes}
                  onChange={(e) => setCancellationNotes(e.target.value)}
                  rows={3}
                  required
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-end">
                <Button
                  variant="destructive"
                  size="lg"
                  onClick={handleCancel}
                  disabled={cancelBooking.isPending}
                  className="w-full sm:w-auto"
                >
                  {cancelBooking.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Cancelling...
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 mr-2" />
                      Confirm Cancellation
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    setShowCancelForm(false);
                    setCancellationNotes("");
                  }}
                  disabled={cancelBooking.isPending}
                  className="w-full sm:w-auto"
                >
                  Go Back
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
};

export default BookingApproval;


import { UK_TIME_ZONE } from '@/lib/datetime';