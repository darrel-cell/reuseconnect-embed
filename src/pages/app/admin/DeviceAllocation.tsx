import { useState, useEffect, useMemo } from "react";
import type { ParsedJmlDevice } from "@/lib/jml-booking-device-details";
import { motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Package, Loader2, CheckCircle2, User, Mail, Phone, Calendar, MapPin, X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useBooking } from "@/hooks/useBookings";
import { useInventory, useMoverAllocatedInventory } from "@/hooks/useInventory";
import { useGradingRecords } from "@/hooks/useGrading";
import { jmlBookingService } from "@/services/jml-booking.service";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { InventoryItem } from "@/services/inventory.service";
import { log } from '@/lib/log';

interface DeviceRequirement {
  category: string;
  make: string;
  model: string;
  quantity: number;
  deviceType?: 'Windows' | 'Apple';
}

interface SelectedDevice {
  requirementIndex: number;
  serialNumber: string;
  inventoryItem: InventoryItem;
}

const isAccessoryCategory = (category: string) =>
  String(category || "").trim().toLowerCase().includes("accessor");

const DeviceAllocation = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get("booking");
  const queryClient = useQueryClient();

  const { data: booking, isLoading: isLoadingBooking } = useBooking(bookingId);
  const isMover = booking?.jmlSubType === "mover";
  const { data: gradingRecords = [] } = useGradingRecords(bookingId ?? undefined);
  const { data: allInventoryList = [], isLoading: isLoadingAll } = useInventory(null);
  const { data: moverAllocatedList = [], isLoading: isLoadingMover } = useMoverAllocatedInventory(
    isMover ? booking?.clientId : undefined,
    isMover ? bookingId ?? undefined : undefined
  );
  const allInventory = isMover ? moverAllocatedList : allInventoryList;
  const isLoadingInventory = isMover ? isLoadingMover : isLoadingAll;

  // Extract device requirements from booking status history
  const deviceRequirements = useMemo<DeviceRequirement[]>(() => {
    if (!booking?.statusHistory) return [];

    const isBreakfix = booking?.jmlSubType === "breakfix";

    // Find status history entry with device details
    const deviceHistory = booking.statusHistory.find((h) => 
      h.notes && (
        h.notes.includes('Device details:') ||
        h.notes.includes('broken devices:') ||
        h.notes.includes('Replacement Device details:')
      )
    );

    if (!deviceHistory?.notes) return [];

    // For mover auto-allocation, device requirements extracted from notes can include
    // quantities for Grade `Q` items that were not uploaded to inventory.
    // We reduce accessory requirement quantities to only those graded into inventory (A/B/C).
    const shouldReduceAccessoryQty = booking?.jmlSubType === "mover";
    const normalizeCategory = (s: unknown) => String(s || "").trim().toLowerCase();
    const isAccessoryRequirement = (cat: string) => normalizeCategory(cat).includes("accessor");
    const inventoryGrades = new Set(["A", "B", "C"]);
    const inventoryQtyByAssetId = gradingRecords
      .filter((r) => inventoryGrades.has(String(r.grade)))
      .reduce<Record<string, number>>((acc, r) => {
        const qty = Number(r.quantity || 0);
        if (qty <= 0) return acc;
        acc[r.assetId] = (acc[r.assetId] || 0) + qty;
        return acc;
      }, {});

    const resolveAssetIdForRequirementCategory = (categoryLabel: string): string | undefined => {
      const bookingAsset = booking?.assets?.find(
        (a) => normalizeCategory(a.categoryName) === normalizeCategory(categoryLabel)
      );
      return bookingAsset?.categoryId;
    };

    try {
      // Breakfix: allocate replacement devices, not the broken devices being graded.
      if (isBreakfix) {
        const replacementMatch = deviceHistory.notes.match(/Replacement Device details:\s*(\[.*?\])/i);
        if (replacementMatch && replacementMatch[1]) {
          const devices = JSON.parse(replacementMatch[1]);
          const parsed = devices
            .map((d: ParsedJmlDevice) => ({
              category: (() => {
                const raw = (d.category || "").toString().trim();
                const lower = raw.toLowerCase();
                if (lower.endsWith("laptop")) return "laptop";
                if (lower.endsWith("phone")) return "smart phones";
                return lower;
              })(),
              make: d.make || '',
              model: d.model || '',
              quantity: d.quantity || 1,
              deviceType: d.deviceType || undefined,
            }))
            .filter((d) => d.category && d.category !== 'accessories');

          if (shouldReduceAccessoryQty) {
            return parsed
              .map((req) => {
                if (!isAccessoryRequirement(req.category)) return req;
                const assetId = resolveAssetIdForRequirementCategory(req.category);
                const requiredQty = assetId ? (inventoryQtyByAssetId[assetId] || 0) : req.quantity;
                return { ...req, quantity: requiredQty };
              })
              .filter((req) => req.quantity > 0);
          }

          return parsed;
        }
        // Fallback for older notes that might only have Device details:
      }

      // New starter / mover / fallback: extract JSON from "Device details:" (non-greedy across newlines)
      const jsonMatch =
        deviceHistory.notes.match(
          /Device details:\s*(\[[\s\S]*?\])(?=\s*\.?\s*(?:Current address:|Replacement Device details:|$))/i
        ) || deviceHistory.notes.match(/Device details:\s*(\[[\s\S]*?\])/i);
      if (jsonMatch && jsonMatch[1]) {
        const devices = JSON.parse(jsonMatch[1]);
        const parsed = devices
          .map((d: ParsedJmlDevice) => ({
            category: (() => {
              const raw = (d.category || "").toString().trim();
              const lower = raw.toLowerCase();
              // Map JML display categories to underlying inventory categories
              if (lower.endsWith("laptop")) return "laptop";
              if (lower.endsWith("phone")) return "smart phones";
              return lower;
            })(),
            make: d.make || '',
            model: d.model || '',
            quantity: d.quantity || 1,
            deviceType: d.deviceType || undefined,
          }))
          // Accessories are captured as notes/qty only and are not allocated from inventory
          .filter((d) => d.category && d.category !== 'accessories');

        if (shouldReduceAccessoryQty) {
          return parsed
            .map((req) => {
              if (!isAccessoryRequirement(req.category)) return req;
              const assetId = resolveAssetIdForRequirementCategory(req.category);
              const requiredQty = assetId ? (inventoryQtyByAssetId[assetId] || 0) : req.quantity;
              return { ...req, quantity: requiredQty };
            })
            .filter((req) => req.quantity > 0);
        }

        return parsed;
      }

      // Legacy fallback: old breakfix notes might embed "Device details" after "broken devices".
      const brokenDevicesMatch = deviceHistory.notes.match(/broken devices:.*?Device details:\s*(\[.*?\])/);
      if (brokenDevicesMatch && brokenDevicesMatch[1]) {
        const devices = JSON.parse(brokenDevicesMatch[1]);
        const parsed = devices
          .map((d: ParsedJmlDevice) => ({
            category: (() => {
              const raw = (d.category || "").toString().trim();
              const lower = raw.toLowerCase();
              if (lower.endsWith("laptop")) return "laptop";
              if (lower.endsWith("phone")) return "smart phones";
              return lower;
            })(),
            make: d.make || '',
            model: d.model || '',
            quantity: d.quantity || 1,
            deviceType: d.deviceType || undefined,
          }))
          .filter((d) => d.category && d.category !== 'accessories');

        if (shouldReduceAccessoryQty) {
          return parsed
            .map((req) => {
              if (!isAccessoryRequirement(req.category)) return req;
              const assetId = resolveAssetIdForRequirementCategory(req.category);
              const requiredQty = assetId ? (inventoryQtyByAssetId[assetId] || 0) : req.quantity;
              return { ...req, quantity: requiredQty };
            })
            .filter((req) => req.quantity > 0);
        }

        return parsed;
      }
    } catch (error) {
      log.error('Error parsing device requirements:', error);
    }

    return [];
  }, [booking, gradingRecords]);

  // State for selected devices (one per requirement)
  const [selectedDevices, setSelectedDevices] = useState<SelectedDevice[]>([]);
  // State for select dropdown values (to reset after selection)
  const [selectValues, setSelectValues] = useState<Record<number, string>>({});
  // State for collapsible categories in allocation summary
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});

  // Filter available inventory based on requirements.
  // Mover: list is already mover_allocated for this client; new_starter/breakfix: filter to available only.
  const getAvailableDevicesForRequirement = (requirement: DeviceRequirement): InventoryItem[] => {
    return allInventory.filter(item => {
      const reqMake = String(requirement.make || "").trim();
      const reqModel = String(requirement.model || "").trim();
      const isPlaceholder = (v: string) => {
        const x = v.toLowerCase();
        return !x || ["unknown", "unk", "-", "na", "n/a"].includes(x);
      };

      const matchesCategory = item.category.toLowerCase() === requirement.category.toLowerCase();
      const matchesMake = isPlaceholder(reqMake) ? true : item.make.toLowerCase() === reqMake.toLowerCase();
      const matchesModel = isPlaceholder(reqModel) ? true : item.model.toLowerCase() === reqModel.toLowerCase();
      const categoryNeedsDeviceType =
        requirement.category === "laptop" ||
        requirement.category === "desktop" ||
        requirement.category === "smart phones" ||
        requirement.category === "smart phone";
      const matchesDeviceType = categoryNeedsDeviceType
        ? requirement.deviceType
          ? item.deviceType?.toLowerCase() === requirement.deviceType.toLowerCase()
          : true
        : true;
      const isAvailable = isMover
        ? (item.status === "mover_allocated" && item.allocatedTo === booking?.clientId)
        : (item.status === "available" && !item.allocatedTo);

      return matchesCategory && matchesMake && matchesModel && matchesDeviceType && isAvailable;
    });
  };

  const commitMoverMutation = useMutation({
    mutationFn: ({ bookingId, serialNumbers }: { bookingId: string; serialNumbers: string[] }) =>
      jmlBookingService.commitMoverSelectedDevices(bookingId, serialNumbers),
    onSuccess: (data) => {
      toast.success("Devices allocated to booking", {
        description: `${data.quantity} serial(s) linked. Continue with Book Courier when ready.`,
      });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"], exact: false });
      navigate("/admin/bookings");
    },
    onError: (error) => {
      toast.error("Could not allocate devices", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    },
  });

  const allocateDeviceMutation = useMutation({
    mutationFn: async ({ bookingId, selectedDevices }: { bookingId: string; selectedDevices: SelectedDevice[] }) => {
      // Allocate each device by serial number
      const results = await Promise.all(
        selectedDevices.map(selected => 
          jmlBookingService.allocateDevice(bookingId, {
            serialNumber: selected.serialNumber,
          })
        )
      );

      return {
        allocatedSerialNumbers: selectedDevices.map(s => s.serialNumber),
        quantity: selectedDevices.length,
      };
    },
    onSuccess: (data) => {
      toast.success("Devices allocated successfully!", {
        description: `Allocated ${data.quantity} device(s) to the booking.`,
      });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      // Redirect to bookings page
      navigate("/admin/bookings");
    },
    onError: (error) => {
      toast.error("Failed to allocate devices", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    },
  });

  const handleAllocate = () => {
    if (!bookingId) {
      toast.error("Booking ID is required");
      return;
    }

    // Validate all requirements have devices selected
    const missingSelections = deviceRequirements.filter((req, index) => {
      const selected = selectedDevices.find(s => s.requirementIndex === index);
      return !selected;
    });

    if (missingSelections.length > 0) {
      toast.error(`Please select devices for all ${deviceRequirements.length} requirement(s)`);
      return;
    }

    // Check if enough devices are selected for each requirement
    for (let i = 0; i < deviceRequirements.length; i++) {
      const requirement = deviceRequirements[i];
      const selectedForReq = selectedDevices.filter(s => s.requirementIndex === i);
      if (selectedForReq.length < requirement.quantity) {
        toast.error(`Requirement ${i + 1} needs ${requirement.quantity} device(s), but only ${selectedForReq.length} selected`);
        return;
      }
    }

    const canAllocateStatus =
      booking?.status === "created" ||
      booking?.status === "pending" ||
      booking?.status === "device_allocated" ||
      (booking?.jmlSubType === "mover" && booking?.status === "inventory");

    if (!canAllocateStatus) {
      toast.error("This booking cannot have devices allocated in its current status");
      return;
    }

    if (booking?.jmlSubType === "mover" && booking?.status === "inventory") {
      commitMoverMutation.mutate({
        bookingId,
        serialNumbers: selectedDevices.map((s) => s.serialNumber),
      });
      return;
    }

    allocateDeviceMutation.mutate({ bookingId, selectedDevices });
  };

  const handleDeviceSelect = (requirementIndex: number, serialNumber: string) => {
    const inventoryItem = allInventory.find(item => item.serialNumber === serialNumber);
    if (!inventoryItem) return;

    // Check if this device is already selected for this requirement
    const alreadySelected = selectedDevices.some(
      s => s.requirementIndex === requirementIndex && s.serialNumber === serialNumber
    );

    if (alreadySelected) {
      // Reset select value
      setSelectValues(prev => ({ ...prev, [requirementIndex]: "" }));
      return;
    }

    // Check if we've reached the quantity limit for this requirement
    const requirement = deviceRequirements[requirementIndex];
    const selectedForReq = selectedDevices.filter(s => s.requirementIndex === requirementIndex);
    
    if (selectedForReq.length >= requirement.quantity) {
      toast.error(`Maximum ${requirement.quantity} device(s) allowed for this requirement`);
      setSelectValues(prev => ({ ...prev, [requirementIndex]: "" }));
      return;
    }

    // Add new selection
    setSelectedDevices(prev => [...prev, { requirementIndex, serialNumber, inventoryItem }]);
    
    // Reset select value to allow selecting another device
    setSelectValues(prev => ({ ...prev, [requirementIndex]: "" }));
  };

  const handleRemoveDevice = (requirementIndex: number, serialNumber: string) => {
    setSelectedDevices(prev => 
      prev.filter(s => !(s.requirementIndex === requirementIndex && s.serialNumber === serialNumber))
    );
  };

  // Reset selections when booking changes
  useEffect(() => {
    if (booking) {
      setSelectedDevices([]);
      setSelectValues({});
      setOpenCategories({});
    }
  }, [booking]);

  const moverInventoryFlow =
    booking?.jmlSubType === "mover" && booking?.status === "inventory";

  // Mover @ inventory: preselect matching devices as if admin selected them manually.
  useEffect(() => {
    if (!moverInventoryFlow) return;
    if (deviceRequirements.length === 0 || allInventory.length === 0) return;
    if (selectedDevices.length > 0) return;

    const usedSerials = new Set<string>();
    const autoSelected: SelectedDevice[] = [];

    deviceRequirements.forEach((requirement, requirementIndex) => {
      const reqMake = String(requirement.make || "").trim();
      const reqModel = String(requirement.model || "").trim();
      const isPlaceholder = (v: string) => {
        const x = v.toLowerCase();
        return !x || ["unknown", "unk", "-", "na", "n/a"].includes(x);
      };

      const categoryNeedsDeviceType =
        requirement.category === "laptop" ||
        requirement.category === "desktop" ||
        requirement.category === "smart phones" ||
        requirement.category === "smart phone";

      const available = allInventory.filter((item) => {
        const matchesCategory = item.category.toLowerCase() === requirement.category.toLowerCase();
        const matchesMake = isPlaceholder(reqMake) ? true : item.make.toLowerCase() === reqMake.toLowerCase();
        const matchesModel = isPlaceholder(reqModel) ? true : item.model.toLowerCase() === reqModel.toLowerCase();
        const matchesDeviceType = categoryNeedsDeviceType
          ? requirement.deviceType
            ? item.deviceType?.toLowerCase() === requirement.deviceType.toLowerCase()
            : true
          : true;
        const isAvailable =
          item.status === "mover_allocated" &&
          item.allocatedTo === booking?.clientId &&
          !usedSerials.has(item.serialNumber);

        return matchesCategory && matchesMake && matchesModel && matchesDeviceType && isAvailable;
      });

      available.slice(0, requirement.quantity).forEach((item) => {
        usedSerials.add(item.serialNumber);
        autoSelected.push({
          requirementIndex,
          serialNumber: item.serialNumber,
          inventoryItem: item,
        });
      });
    });

    if (autoSelected.length > 0) {
      setSelectedDevices(autoSelected);
      setSelectValues({});
    }
  }, [
    moverInventoryFlow,
    deviceRequirements,
    allInventory,
    booking?.clientId,
    selectedDevices.length,
  ]);

  if (isLoadingBooking) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground text-center max-w-md">Loading…</p>
      </div>
    );
  }

  if (!moverInventoryFlow && isLoadingInventory) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground text-center max-w-md">Loading…</p>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertDescription>Booking not found</AlertDescription>
        </Alert>
        <Button onClick={() => navigate("/admin/bookings")}>Back to Booking Queue</Button>
      </div>
    );
  }

  // Only allow device allocation for new_starter, breakfix, and mover JML bookings
  if (booking.bookingType !== 'jml' || (booking.jmlSubType !== 'new_starter' && booking.jmlSubType !== 'breakfix' && booking.jmlSubType !== 'mover')) {
    return (
      <div className="space-y-6">
        <Alert>
          <AlertDescription>
            Device allocation is only available for New Starter, Breakfix, and Mover JML bookings.
            Current booking type: {booking.bookingType} / {booking.jmlSubType}
          </AlertDescription>
        </Alert>
        <Button onClick={() => navigate("/admin/bookings")}>Back to Booking Queue</Button>
      </div>
    );
  }

  const moverAllowed =
    booking.jmlSubType === "mover" &&
    (booking.status === "inventory" ||
      booking.status === "created" ||
      booking.status === "pending" ||
      booking.status === "device_allocated");
  const otherJmlAllowed =
    booking.jmlSubType !== "mover" &&
    (booking.status === "created" || booking.status === "pending" || booking.status === "device_allocated");

  if (!moverAllowed && !otherJmlAllowed) {
    return (
      <div className="space-y-6">
        <Alert>
          <AlertDescription>
            This booking cannot have devices allocated. For mover bookings, open this page from the queue when status is Inventory (auto-allocate) or Device allocated (already done).
            Current status: {booking.status}
          </AlertDescription>
        </Alert>
        <Button onClick={() => navigate("/admin/bookings")}>Back to Booking Queue</Button>
      </div>
    );
  }

  if (booking.jmlSubType === "mover" && booking.status === "device_allocated") {
    return (
      <div className="space-y-6 max-w-lg mx-auto">
        <Alert>
          <AlertDescription>
            Devices are already allocated for this mover booking. Continue with <strong>Book Courier</strong> from the queue.
          </AlertDescription>
        </Alert>
        <Button onClick={() => navigate("/admin/bookings")}>Back to Booking Queue</Button>
      </div>
    );
  }

  const subTypeLabels: Record<string, string> = {
    new_starter: "New Starter",
    breakfix: "Breakfix",
    mover: "Mover",
  };

  const getCategoryDisplay = (category: string) => {
    return category.charAt(0).toUpperCase() + category.slice(1);
  };

  const startDateSource =
    booking.startDate ||
    booking.scheduledAt ||
    booking.deliveryDate ||
    booking.createdAt ||
    null;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4"
      >
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/bookings")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <p className="text-muted-foreground">Allocate devices from inventory for {subTypeLabels[booking.jmlSubType || '']} booking</p>
        </div>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Booking Details - Small Section */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Booking Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Booking Number</p>
                  <p className="font-mono text-xs">{booking.bookingNumber}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-muted-foreground">Organisation</p>
                    <p className="font-semibold">{booking.organisationName || booking.clientName}</p>
                  </div>
                  {booking.createdByName && (
                    <div>
                      <p className="text-muted-foreground">Booked by</p>
                      <p>{booking.createdByName}</p>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-muted-foreground">Site</p>
                  <p className="text-xs">{booking.siteName}, {booking.siteAddress}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Start Date</p>
                  <p className="text-xs">{startDateSource ? format(new Date(startDateSource), "PPP") : "N/A"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {deviceRequirements.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Device Requirements</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {deviceRequirements.map((requirement, index) => {
                  const availableDevices = getAvailableDevicesForRequirement(requirement);
                  const selectedDevice = selectedDevices.find(s => s.requirementIndex === index);
                  const selectedForReq = selectedDevices.filter(s => s.requirementIndex === index);

                  return (
                    <div key={index} className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold">Requirement {index + 1}</p>
                          <p className="text-sm text-muted-foreground">
                            {getCategoryDisplay(requirement.category)} • {requirement.make} • {requirement.model}
                            {(requirement.category === "laptop" || requirement.category === "desktop") && requirement.deviceType && ` • ${requirement.deviceType}`}
                            {requirement.quantity > 1 && ` • Qty: ${requirement.quantity}`}
                          </p>
                        </div>
                        <Badge variant={selectedForReq.length >= requirement.quantity ? "default" : "secondary"}>
                          {selectedForReq.length} / {requirement.quantity}
                        </Badge>
                      </div>

                      <div className="space-y-2">
                        <Label>Select Device from Inventory</Label>
                        {availableDevices.length === 0 ? (
                          <Alert>
                            <AlertDescription className="text-sm">
                              No available devices in inventory matching this requirement.
                              Please add devices to inventory first.
                            </AlertDescription>
                          </Alert>
                        ) : availableDevices.filter(item => !selectedForReq.some(s => s.serialNumber === item.serialNumber)).length === 0 ? (
                          <Alert>
                            <AlertDescription className="text-sm">
                              All available devices for this requirement have been selected.
                            </AlertDescription>
                          </Alert>
                        ) : (
                          <Select
                            value={selectValues[index] || ""}
                            onValueChange={(value) => handleDeviceSelect(index, value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Choose a device..." />
                            </SelectTrigger>
                            <SelectContent>
                              {availableDevices
                                .filter(item => !selectedForReq.some(s => s.serialNumber === item.serialNumber))
                                .map((item) => (
                                  <SelectItem key={item.id} value={item.serialNumber}>
                                    <div className="flex flex-col gap-1">
                                      {!isAccessoryCategory(requirement.category) && (
                                        <span className="font-medium">
                                          {String(item.make || "").trim() || "-"} • {String(item.model || "").trim() || "-"}
                                        </span>
                                      )}
                                      <div className="text-xs text-muted-foreground">
                                        <span className="font-mono">{item.serialNumber}</span>
                                        {!isAccessoryCategory(requirement.category) && (
                                          <span className="ml-2">
                                            • Condition: {String(item.conditionCode || "").trim() || "-"}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>

                      {selectedForReq.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Selected Devices ({selectedForReq.length} / {requirement.quantity})</p>
                          <div className="grid grid-cols-2 gap-2">
                            {selectedForReq.map((selected, idx) => (
                              <div key={idx} className="p-2 rounded-lg bg-muted/50 border border-muted text-xs">
                                <div className="flex items-center justify-between mb-1">
                                  <p className="font-medium text-xs">Device {idx + 1}</p>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 w-5 p-0"
                                    onClick={() => handleRemoveDevice(index, selected.serialNumber)}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                                 <div className="space-y-0.5">
                                   {!isAccessoryCategory(requirement.category) && (
                                     <p className="text-xs">
                                       <span className="text-muted-foreground">Make/Model:</span>{" "}
                                       {String(selected.inventoryItem.make || "").trim() || "-"} •{" "}
                                       {String(selected.inventoryItem.model || "").trim() || "-"}
                                     </p>
                                   )}
                                   <p className="text-xs">
                                     <span className="text-muted-foreground">Serial Number:</span> <span className="font-mono">{selected.inventoryItem.serialNumber}</span>
                                   </p>
                                   {!isAccessoryCategory(requirement.category) && (
                                     <p className="text-xs">
                                       <span className="text-muted-foreground">Condition Code:</span>{" "}
                                       {String(selected.inventoryItem.conditionCode || "").trim() || "-"}
                                     </p>
                                   )}
                                 </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Allow selecting more devices if quantity > 1 */}
                      {requirement.quantity > 1 && selectedForReq.length < requirement.quantity && (
                        <div className="text-xs text-muted-foreground">
                          Select {requirement.quantity - selectedForReq.length} more device(s) from the dropdown above
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {deviceRequirements.length === 0 && (
            <Card>
              <CardContent className="py-8">
                <Alert>
                  <AlertDescription>
                    No device requirements found for this booking. Please check the booking details.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Allocation Summary */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Allocation Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedDevices.length > 0 ? (
                <>
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Selected Devices ({selectedDevices.length})</p>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {(() => {
                        // Group selected devices by category
                        const devicesByCategory = selectedDevices.reduce((acc, selected) => {
                          const requirement = deviceRequirements[selected.requirementIndex];
                          const category = getCategoryDisplay(requirement.category);
                          if (!acc[category]) {
                            acc[category] = [];
                          }
                          acc[category].push(selected);
                          return acc;
                        }, {} as Record<string, SelectedDevice[]>);

                        return Object.entries(devicesByCategory).map(([category, devices]) => {
                          const isOpen = openCategories[category] !== false; // Default to open
                          return (
                            <Collapsible key={category} open={isOpen} onOpenChange={(open) => setOpenCategories(prev => ({ ...prev, [category]: open }))}>
                              <div className="border rounded-lg">
                                <CollapsibleTrigger className="w-full flex items-center justify-between p-2 hover:bg-muted/50 transition-colors">
                                  <span className="text-sm font-medium">{category}</span>
                                  {isOpen ? (
                                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <div className="p-2 space-y-2 border-t">
                                    {devices.map((selected, idx) => {
                                      const requirement = deviceRequirements[selected.requirementIndex];
                                      const deviceType = (requirement.category === "laptop" || requirement.category === "desktop") && selected.inventoryItem.deviceType
                                        ? ` • ${selected.inventoryItem.deviceType}`
                                        : '';
                                      const isAccessory = isAccessoryCategory(requirement.category);
                                      return (
                                        <div key={idx} className="p-2 rounded border bg-card text-xs">
                                          {!isAccessory && (
                                            <p className="font-medium mb-1">
                                              {selected.inventoryItem.make} • {selected.inventoryItem.model}{deviceType}
                                            </p>
                                          )}
                                          <p className="font-mono text-xs mb-1">{selected.inventoryItem.serialNumber}</p>
                                          {!isAccessory && selected.inventoryItem.conditionCode && (
                                            <p className="text-xs text-muted-foreground">{selected.inventoryItem.conditionCode}</p>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </CollapsibleContent>
                              </div>
                            </Collapsible>
                          );
                        });
                      })()}
                    </div>
                  </div>

                  {allocateDeviceMutation.isSuccess ? (
                    <div className="space-y-4">
                      <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 space-y-3">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                          <span className="font-semibold text-green-500">Devices Allocated Successfully</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium mb-2">Allocated Serial Numbers ({selectedDevices.length}):</p>
                          <div className="flex flex-wrap gap-2">
                            {selectedDevices.map((selected, index) => (
                              <Badge key={index} variant="outline" className="font-mono">
                                {selected.serialNumber}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <Button
                        onClick={() => navigate("/admin/bookings")}
                        className="w-full"
                      >
                        Back to Booking Queue
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="default"
                      onClick={handleAllocate}
                      disabled={
                        deviceRequirements.length === 0 ||
                        selectedDevices.length === 0 ||
                        deviceRequirements.some((req, idx) => {
                          const selectedForReq = selectedDevices.filter(s => s.requirementIndex === idx);
                          return selectedForReq.length < req.quantity;
                        }) ||
                        allocateDeviceMutation.isPending ||
                        commitMoverMutation.isPending
                      }
                      className="w-full"
                    >
                      {allocateDeviceMutation.isPending || commitMoverMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Allocating...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Allocate Devices
                        </>
                      )}
                    </Button>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">Select devices from the requirements above to allocate them.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DeviceAllocation;
