import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, FileCheck, Loader2, Recycle, Warehouse, Upload, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useBooking, useUpdateBookingStatus } from "@/hooks/useBookings";
import { useGradingRecords } from "@/hooks/useGrading";
import { useUploadInventory } from "@/hooks/useInventory";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { categoryRequiresImei, inferDeviceTypeFromJmlCategory, shouldShowDeviceTypeForJmlCategory } from "@/lib/jml-assets";
import { buildJmlDeviceDetailsMapFromBooking, lookupJmlDeviceDetails } from "@/lib/jml-booking-device-details";

const gradeColors: Record<string, string> = {
  A: "bg-success/10 text-success",
  B: "bg-info/10 text-info",
  C: "bg-warning/10 text-warning",
  D: "bg-destructive/10 text-destructive",
  Q: "bg-destructive/10 text-destructive",
};

function BookingInventory() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: booking, isLoading: isLoadingBooking } = useBooking(id || null);
  const { data: records = [], isLoading: isLoadingRecords } = useGradingRecords(id);
  const uploadInventory = useUploadInventory();
  const [hasAddedToInventory, setHasAddedToInventory] = useState(false);
  const updateBookingStatus = useUpdateBookingStatus();

  const deviceDetailsMap = useMemo(
    () =>
      buildJmlDeviceDetailsMapFromBooking({
        jmlSubType: (booking as { jmlSubType?: string })?.jmlSubType,
        statusHistory: (booking as { statusHistory?: Array<{ notes?: string }> })?.statusHistory,
      }),
    [booking]
  );

  useEffect(() => {
    if (booking?.status === "inventory") {
      setHasAddedToInventory(true);
    }
  }, [booking?.status]);

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
          <Link to="/admin/bookings" className="text-inherit no-underline">
            Back to Booking Queue
          </Link>
        </Button>
      </div>
    );
  }

  const isMoverBooking =
    booking.bookingType === "jml" && (booking as { jmlSubType?: string }).jmlSubType === "mover";
  // Leaver/breakfix/mover: after graded (same collection leg). Any: when already at inventory step.
  const canAccessInventoryPage =
    booking.status === "inventory" || booking.status === "graded";
  if (!canAccessInventoryPage) {
    return (
      <div className="space-y-6">
        <Alert>
          <AlertDescription>
            {isMoverBooking
              ? `Add to inventory is available after grading (or when already in inventory). Current status: ${booking.status}`
              : `Inventory processing is only available after grading. Current status: ${booking.status}`}
          </AlertDescription>
        </Alert>
        <Button asChild>
          <Link to="/admin/bookings" className="text-inherit no-underline">
            Back to Booking Queue
          </Link>
        </Button>
      </div>
    );
  }

  const inventoryRecords = records.filter((r) => ["A", "B", "C"].includes(r.grade));
  const disposalRecords = records.filter((r) => ["D", "Q"].includes(r.grade));

  const canProceedToDeviceAllocation = !isMoverBooking || booking.status === "inventory";

  const handleUploadToInventory = () => {
    if (!booking) return;

    const missingSerials = inventoryRecords.filter((r) => !r.serialNumbers?.length);
    if (missingSerials.length > 0) {
      toast.error("Cannot add to inventory", {
        description: "Some Grade A/B/C records are missing serial numbers.",
      });
      return;
    }

    for (const r of inventoryRecords) {
      if (!categoryRequiresImei(r.assetCategory)) continue;
      const serials = r.serialNumbers || [];
      const imeis = r.imeiNumbers || [];
      if (imeis.length !== serials.length || imeis.some((x) => !String(x).trim())) {
        toast.error("Cannot add to inventory", {
          description: `Phones/tablets need one IMEI per serial (${r.assetCategory}). Re-grade with IMEIs if missing.`,
        });
        return;
      }
    }

    const buildConditionCode = (make: string, grade: string) => {
      const prefix = (make || "")
        .replace(/[^a-zA-Z]/g, "")
        .toUpperCase()
        .slice(0, 3);
      const g = (grade || "").toUpperCase().slice(0, 1);
      return prefix.length === 3 && g ? `${prefix}${g}` : "";
    };

    const isMover =
      (booking as { bookingType?: string; jmlSubType?: string })?.bookingType === "jml" &&
      (booking as { jmlSubType?: string })?.jmlSubType === "mover";
    const items = inventoryRecords.flatMap((r) => {
      const grade = (r.grade || "").toString().toUpperCase();
      const details = lookupJmlDeviceDetails(deviceDetailsMap, r.assetCategory);
      const make = (details.make || "Unknown").toString().trim() || "Unknown";
      const model = (details.model || "Unknown").toString().trim() || "Unknown";
      const conditionCode = (r.condition || buildConditionCode(make, grade)).toString().trim();
      const deviceType = shouldShowDeviceTypeForJmlCategory(r.assetCategory)
        ? String(details.deviceType || inferDeviceTypeFromJmlCategory(r.assetCategory)).trim() || null
        : null;

      return (r.serialNumbers || []).map((serialNumber, idx) => ({
        category: r.assetCategory,
        deviceType,
        make,
        model,
        serialNumber,
        imei: categoryRequiresImei(r.assetCategory)
          ? String((r.imeiNumbers || [])[idx] || "").trim() || undefined
          : undefined,
        conditionCode,
        status: isMover ? "mover_allocated" : "available",
      }));
    });

    if (items.length === 0) {
      toast.error("No inventory-grade items to upload");
      return;
    }

    uploadInventory.mutate(
      {
        items,
        clientId: isMover && booking.clientId ? booking.clientId : undefined,
        sourceBookingId: isMover && id ? id : undefined,
      },
      {
        onSuccess: () => {
          setHasAddedToInventory(true);
          // Ensure booking is moved into "inventory" status after successful upload.
          // This prevents final-overview completion from attempting an invalid graded → completed transition.
          if (booking?.status !== "inventory" && id) {
            updateBookingStatus.mutate({ bookingId: id, status: "inventory" });
          }
        },
        onError: (error) => {
          toast.error("Failed to add devices to inventory", {
            description: error instanceof Error ? error.message : "Please try again.",
          });
        },
      }
    );
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
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
          <p className="text-muted-foreground">{booking.bookingNumber}</p>
        </div>
        <Badge className={cn("bg-green-500/10 text-green-500", "px-3 py-1")}>
          {isMoverBooking ? "Mover · Add inventory" : "Inventory"}
        </Badge>
      </motion.div>

      {isMoverBooking && (
        <Alert>
          <AlertDescription>
            For mover bookings, devices you add here are stored as <strong>mover_allocated</strong> for this client. At{" "}
            <strong>Device allocated</strong>, only those devices (same client) can be allocated to the booking.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Warehouse className="h-5 w-5" />
              Add Devices to Inventory (Grades A/B/C)
            </CardTitle>
            <Button
              size="sm"
              variant="default"
              onClick={handleUploadToInventory}
              disabled={inventoryRecords.length === 0 || uploadInventory.isPending || hasAddedToInventory}
            >
              {uploadInventory.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : hasAddedToInventory ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Added to Inventory
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Add to Inventory
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {inventoryRecords.length === 0 ? (
            <p className="text-sm text-muted-foreground">No inventory-grade items found.</p>
          ) : (
            inventoryRecords.map((r) => (
              <div
                key={r.id}
                className={cn(
                  "p-3 rounded-lg border",
                  hasAddedToInventory ? "bg-success/5 border-success/30" : "bg-muted/30"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{r.assetCategory}</p>
                    <p className="text-sm text-muted-foreground">
                      Qty: {r.quantity} • Condition: {r.condition || "-"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {hasAddedToInventory && (
                      <span className="inline-flex items-center gap-1 text-success text-sm font-medium">
                        <CheckCircle2 className="h-4 w-4" />
                        Added
                      </span>
                    )}
                    <Badge className={gradeColors[r.grade] || ""}>Grade {r.grade}</Badge>
                  </div>
                </div>
                {r.serialNumbers?.length ? (
                  <p className="mt-2 text-sm">
                    <span className="text-muted-foreground">Serials:</span>{" "}
                    <span className="font-mono">{r.serialNumbers.join(", ")}</span>
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-destructive">
                    Missing serial numbers (required for A/B/C).
                  </p>
                )}
                {categoryRequiresImei(r.assetCategory) && r.imeiNumbers?.length ? (
                  <p className="mt-1 text-sm">
                    <span className="text-muted-foreground">IMEI:</span>{" "}
                    <span className="font-mono">{r.imeiNumbers.join(", ")}</span>
                  </p>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Recycle className="h-5 w-5" />
            Disposal List (Grades D/Q)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {disposalRecords.length === 0 ? (
            <p className="text-sm text-muted-foreground">No disposal items found.</p>
          ) : (
            disposalRecords.map((r) => (
              <div key={r.id} className="p-3 rounded-lg bg-muted/30 border">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{r.assetCategory}</p>
                    <p className="text-sm text-muted-foreground">
                      Qty: {r.quantity} • Condition: {r.condition || "-"}
                    </p>
                  </div>
                  <Badge className={gradeColors[r.grade] || ""}>Grade {r.grade}</Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-2 border-success/20 bg-success/5">
        <CardContent className="pt-6 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div>
            <p className="font-medium">{isMoverBooking ? "Device Allocation" : "Final Review"}</p>
            <p className="text-sm text-muted-foreground">
              {isMoverBooking
                ? "Allocate devices for this mover booking."
                : "Review inventory and disposal items, then approve to complete the booking."}
            </p>
          </div>
          <Button
            variant="success"
            size="lg"
            disabled={!canProceedToDeviceAllocation}
            onClick={() => {
              if (isMoverBooking && booking.status !== "inventory") {
                toast.error("Cannot allocate devices yet", {
                  description: "For mover bookings, device allocation is available after you add devices to inventory (status must be `inventory`).",
                });
                return;
              }
              navigate(isMoverBooking ? `/admin/device-allocation?booking=${id}` : `/booking-review/${id}`);
            }}
          >
            <FileCheck className="h-4 w-4 mr-2" />
            {isMoverBooking ? "Proceed to Device Allocate" : "Proceed to Final Review"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default BookingInventory;
