import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Award, Loader2, Plus, PoundSterling, CheckCircle2, FileCheck, ArrowRight, X, Smartphone, Trash2, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBooking, useUpdateBookingStatus } from "@/hooks/useBookings";
import { useGradingRecords, useCreateGradingRecord, useCalculateResaleValue, useCalculateResaleValueFn } from "@/hooks/useGrading";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import { categoryRequiresImei, getUnderlyingAssetCategoryNameForJml } from "@/lib/jml-assets";
import { type ParsedJmlDevice, buildJmlDeviceDetailsMapFromBooking } from "@/lib/jml-booking-device-details";
import { compareGradingSerialVsInventory } from "@/lib/serial-inventory-compare";
import { SerialInventorySnapshot } from "@/components/inventory/SerialInventorySnapshot";
import { inventoryService, type InventoryLookupResult } from "@/services/inventory.service";

type GradeValue = 'A' | 'B' | 'C' | 'D' | 'Q';
const isGradeValue = (value: string): value is GradeValue =>
  value === 'A' || value === 'B' || value === 'C' || value === 'D' || value === 'Q';

const grades: { value: GradeValue; label: string; color: string }[] = [
  { value: 'A', label: 'Grade A', color: 'bg-success/10 text-success' },
  { value: 'B', label: 'Grade B', color: 'bg-info/10 text-info' },
  { value: 'C', label: 'Grade C', color: 'bg-warning/10 text-warning' },
  { value: 'D', label: 'Grade D', color: 'bg-destructive/10 text-destructive' },
  { value: 'Q', label: 'Grade Q', color: 'bg-destructive/10 text-destructive' },
];

type SerialImeiPair = { serial: string; imei: string };
type InventoryEditDraft = { make: string; model: string; deviceType: string; imei: string };

const Grading = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isWarehouseTechnician = user?.role === "warehouse_technician";
  const backTo = isWarehouseTechnician ? "/jobs" : "/admin/bookings";
  const { data: booking, isLoading: isLoadingBooking } = useBooking(id || null);
  const { data: records = [], isLoading: isLoadingRecords } = useGradingRecords(id);
  const createRecord = useCreateGradingRecord();
  const calculateResaleValueFn = useCalculateResaleValueFn();
  const updateBookingStatus = useUpdateBookingStatus();
  
  // State declarations must come before they're used
  const [selectedAssetId, setSelectedAssetId] = useState<string>("");
  const [grade, setGrade] = useState<GradeValue | "">("");
  const [condition, setCondition] = useState<string>(""); // conditionCode
  const [notes, setNotes] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);
  const [serialNumbersText, setSerialNumbersText] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [serialInput, setSerialInput] = useState<string>("");
  /** One row per device when phone/tablet needs IMEI; index aligns serial ↔ IMEI for save. */
  const [serialImeiPairs, setSerialImeiPairs] = useState<SerialImeiPair[]>([{ serial: "", imei: "" }]);
  const [serialDbLookup, setSerialDbLookup] = useState<Record<string, InventoryLookupResult | null>>({});
  const [serialLookupLoading, setSerialLookupLoading] = useState<Record<string, boolean>>({});
  const [editingInventoryBySerial, setEditingInventoryBySerial] = useState<Record<string, boolean>>({});
  const [editingInventoryDraftBySerial, setEditingInventoryDraftBySerial] = useState<Record<string, InventoryEditDraft>>({});
  const [savingInventoryBySerial, setSavingInventoryBySerial] = useState<Record<string, boolean>>({});

  const selectedAsset = booking?.assets.find(a => a.categoryId === selectedAssetId);

  const isSelectedAssetAccessory = useMemo(() => {
    const c = selectedAsset?.categoryName || "";
    return String(c).trim().toLowerCase().includes("accessor");
  }, [selectedAsset?.categoryName]);

  const selectedCategoryRequiresImei = useMemo(() => {
    if (!selectedAsset) return false;
    return categoryRequiresImei(selectedAsset.categoryName || "");
  }, [selectedAsset]);

  const isAbcInventoryGrade = ["A", "B", "C"].includes(grade);
  const isItadBooking = booking?.bookingType !== "jml";
  const useSerialImeiPairing = !isItadBooking && isAbcInventoryGrade && selectedCategoryRequiresImei;

  useEffect(() => {
    if (!useSerialImeiPairing) return;
    const q = Math.max(1, quantity);
    setSerialImeiPairs((prev) => {
      const next = prev.slice(0, q);
      while (next.length < q) next.push({ serial: "", imei: "" });
      return next;
    });
  }, [quantity, useSerialImeiPairing]);

  // Pull device make/model from booking status history (JML creates these notes).
  const deviceDetailsMap = useMemo(() => {
    const map = new Map<string, { make?: string; model?: string; deviceType?: string; notes?: string }>();
    if (!booking) return map;

    const statusHistory = booking.statusHistory;
    if (!statusHistory?.length) return map;

    const isBreakfix = booking?.jmlSubType === 'breakfix';
    const creationHistory = statusHistory.find(h =>
      h.notes &&
      (isBreakfix
        ? h.notes.includes('Replacement Device details:')
        : h.notes.includes('Device details:'))
    );
    if (!creationHistory?.notes) return map;

    try {
      // Prefer extracting the broken-device "Device details" block when breakfix notes contain both:
      // "... Device details: <brokenArray>. Replacement Device details: <replacementArray>"
            const deviceDetailsMatch =
              creationHistory.notes.match(
                /Device details:\s*(\[[\s\S]*?\])(?=\s*\.?\s*Replacement Device details:|$)/i
              ) || creationHistory.notes.match(/Device details:\s*(\[[\s\S]*?\])/i);
      if (!deviceDetailsMatch) return map;

      const deviceDetails = JSON.parse(deviceDetailsMatch[1]);
      deviceDetails.forEach((device: ParsedJmlDevice) => {
        if (!device?.category) return;

        const rawCategory = String(device.category).trim();
        const normalizedKey = rawCategory.toLowerCase();

        // Store under lowercased UI category key (e.g. "Phone")
        map.set(normalizedKey, {
          make: device.make,
          model: device.model,
          deviceType: device.deviceType,
          notes: device.notes,
        });

        // Also store under underlying DB category name when possible
        // Example: UI "Phone" -> DB "Smart Phones"
        const underlyingCategory = getUnderlyingAssetCategoryNameForJml(rawCategory);
        if (underlyingCategory) {
          map.set(underlyingCategory.toLowerCase(), {
            make: device.make,
            model: device.model,
            deviceType: device.deviceType,
            notes: device.notes,
          });
        }
      });
    } catch {
      // Ignore parse errors; grading can still proceed without device details.
    }

    return map;
  }, [booking]);

  const selectedAssetDevice = useMemo(() => {
    if (!selectedAsset) return undefined;
    const categoryNameKey = selectedAsset.categoryName
      ? String(selectedAsset.categoryName).trim().toLowerCase()
      : "";
    const categoryIdKey = selectedAsset.categoryId
      ? String(selectedAsset.categoryId).trim().toLowerCase()
      : "";

    const byName = categoryNameKey ? deviceDetailsMap.get(categoryNameKey) : undefined;
    if (byName) return byName;

    const byId = categoryIdKey ? deviceDetailsMap.get(categoryIdKey) : undefined;
    if (byId) return byId;

    return undefined;
  }, [deviceDetailsMap, selectedAsset]);

  const alreadyGradedQtyForSelected = useMemo(() => {
    if (!selectedAssetId) return 0;
    return records
      .filter(r => r.assetId === selectedAssetId)
      .reduce((sum, r) => sum + (r.quantity || 0), 0);
  }, [records, selectedAssetId]);
  const remainingQtyForSelected = Math.max(0, (selectedAsset?.quantity || 0) - alreadyGradedQtyForSelected);

  const parsedSerialNumbers = useMemo(() => {
    if (useSerialImeiPairing) {
      return serialImeiPairs.map((r) => r.serial.trim());
    }
    return serialNumbersText
      .split(/[\n,]+/g)
      .map((s) => s.trim())
      .filter(Boolean);
  }, [useSerialImeiPairing, serialImeiPairs, serialNumbersText]);

  const parsedImeiNumbers = useMemo(() => {
    if (useSerialImeiPairing) {
      return serialImeiPairs.map((r) => r.imei.trim());
    }
    return [];
  }, [useSerialImeiPairing, serialImeiPairs]);

  const firstResolvedSerialKey = useMemo(() => {
    const first = parsedSerialNumbers.find((s) => s.trim());
    return first ? first.trim().toLowerCase() : null;
  }, [parsedSerialNumbers]);

  const effectiveMakeForCondition = useMemo(() => {
    if (firstResolvedSerialKey) {
      const draft = editingInventoryDraftBySerial[firstResolvedSerialKey];
      if (draft?.make?.trim()) return draft.make.trim();
      const lookup = serialDbLookup[firstResolvedSerialKey];
      if (lookup?.found && lookup.inventory.make?.trim()) return lookup.inventory.make.trim();
    }
    return (selectedAssetDevice?.make || "").trim();
  }, [firstResolvedSerialKey, editingInventoryDraftBySerial, serialDbLookup, selectedAssetDevice?.make]);

  const autoConditionCode = useMemo(() => {
    const g = (grade || '').trim().toUpperCase();
    if (!g) return '';

    const make = effectiveMakeForCondition;
    if (!make) return '';

    const prefix = make.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 3);
    if (!prefix) return '';
    return `${prefix}${g.slice(0, 1)}`;
  }, [grade, effectiveMakeForCondition]);

  useEffect(() => {
    if (autoConditionCode) setCondition(autoConditionCode);
  }, [autoConditionCode]);

  const updateSerialImeiPair = (index: number, field: keyof SerialImeiPair, value: string) => {
    setSerialImeiPairs((prev) => {
      const next = [...prev];
      if (!next[index]) return prev;
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  /** Max devices in this submission = remaining ungraded units for the selected asset. */
  const maxDevicesThisSubmission = Math.max(1, remainingQtyForSelected);

  const addSerialImeiRow = () => {
    setQuantity((q) => Math.min(maxDevicesThisSubmission, q + 1));
  };

  const removeSerialImeiRow = (index: number) => {
    if (serialImeiPairs.length <= 1) return;
    setSerialImeiPairs((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length ? next : [{ serial: "", imei: "" }];
    });
    setQuantity((q) => Math.max(1, q - 1));
  };

  const fetchSerialLookup = useCallback(
    async (serial: string) => {
      const key = serial.trim().toLowerCase();
      if (!key) return;
      setSerialLookupLoading((prev) => ({ ...prev, [key]: true }));
      try {
        const res = await inventoryService.lookupBySerial(serial, booking?.clientId ?? undefined);
        setSerialDbLookup((prev) => ({ ...prev, [key]: res }));
      } finally {
        setSerialLookupLoading((prev) => ({ ...prev, [key]: false }));
      }
    },
    [booking?.clientId]
  );

  const startEditingInventoryForSerial = useCallback((serialKey: string, lookup: InventoryLookupResult | null) => {
    if (!lookup || !lookup.found) return;
    setEditingInventoryBySerial((prev) => ({ ...prev, [serialKey]: true }));
    setEditingInventoryDraftBySerial((prev) => ({
      ...prev,
      [serialKey]: {
        make: lookup.inventory.make || "",
        model: lookup.inventory.model || "",
        deviceType: lookup.inventory.deviceType || "",
        imei: lookup.inventory.imei || "",
      },
    }));
  }, []);

  const saveInventoryEditsForSerial = useCallback(
    async (serialKey: string) => {
      const lookup = serialDbLookup[serialKey];
      const draft = editingInventoryDraftBySerial[serialKey];
      if (!lookup || !lookup.found || !draft) return;

      setSavingInventoryBySerial((prev) => ({ ...prev, [serialKey]: true }));
      try {
        const updated = await inventoryService.updateInventory(lookup.inventory.id, {
          make: draft.make.trim(),
          model: draft.model.trim(),
          deviceType: draft.deviceType.trim() || null,
          imei: draft.imei.trim() || undefined,
        });
        setSerialDbLookup((prev) => ({
          ...prev,
          [serialKey]: {
            ...lookup,
            found: true,
            inventory: {
              ...lookup.inventory,
              make: updated.make,
              model: updated.model,
              deviceType: updated.deviceType || null,
              imei: updated.imei || null,
            },
          },
        }));
        setEditingInventoryBySerial((prev) => ({ ...prev, [serialKey]: false }));
        toast.success("Database details updated");
      } catch (error) {
        toast.error("Failed to update database details", {
          description: error instanceof Error ? error.message : "Please try again.",
        });
      } finally {
        setSavingInventoryBySerial((prev) => ({ ...prev, [serialKey]: false }));
      }
    },
    [editingInventoryDraftBySerial, serialDbLookup]
  );

  const addSerialChip = useCallback(
    (rawValue: string) => {
      const value = rawValue.trim();
      if (!value) return;
      if (parsedSerialNumbers.length >= quantity) return;
      if (!parsedSerialNumbers.includes(value)) {
        setSerialNumbersText((prev) => (prev ? `${prev}\n${value}` : value));
        void fetchSerialLookup(value);
      }
      setSerialInput("");
    },
    [fetchSerialLookup, parsedSerialNumbers, quantity]
  );

  const existingBookingSerialSet = useMemo(() => {
    const set = new Set<string>();
    for (const record of records) {
      for (const serial of record.serialNumbers || []) {
        const normalized = String(serial || "").trim().toLowerCase();
        if (normalized) set.add(normalized);
      }
    }
    return set;
  }, [records]);

  const { data: estimatedResaleValue = 0 } = useCalculateResaleValue(
    selectedAsset?.categoryName || selectedAsset?.categoryId,
    grade || undefined,
    quantity || 0
  );

  const handleCreateRecord = async () => {
    if (!id || !selectedAssetId || !grade || !user) {
      toast.error("Please fill in all required fields");
      return;
    }

    const asset = booking?.assets.find(a => a.categoryId === selectedAssetId);
    if (!asset) {
      toast.error("Asset not found");
      return;
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      toast.error("Quantity must be a positive whole number");
      return;
    }
    if (quantity > remainingQtyForSelected) {
      toast.error("Quantity exceeds remaining ungraded units", {
        description: `Remaining: ${remainingQtyForSelected}`,
      });
      return;
    }
    const isAccessoryCategory = String(asset.categoryName || "")
      .trim()
      .toLowerCase()
      .includes("accessor");

    const finalCondition = (autoConditionCode || condition).trim();
    if (!isItadBooking && !isAccessoryCategory && !finalCondition) {
      toast.error("Condition code is required", {
        description: "Device make is missing, so condition code could not be auto-generated.",
      });
      return;
    }
    if (!isItadBooking && ["A", "B", "C"].includes(grade)) {
      if (useSerialImeiPairing) {
        const emptySerialRow = parsedSerialNumbers.findIndex((s) => !s);
        if (emptySerialRow >= 0) {
          toast.error("Serial number required", {
            description: `Enter a serial for device ${emptySerialRow + 1} (row ${emptySerialRow + 1}).`,
          });
          return;
        }
        const emptyImeiRow = parsedImeiNumbers.findIndex((s) => !s);
        if (emptyImeiRow >= 0) {
          toast.error("IMEI required", {
            description: `Enter an IMEI for device ${emptyImeiRow + 1} (row ${emptyImeiRow + 1}).`,
          });
          return;
        }
      }

      const normalizedInputSerials = parsedSerialNumbers.map((s) => s.trim().toLowerCase()).filter(Boolean);
      const duplicateInputSerials = normalizedInputSerials.filter((s, i) => normalizedInputSerials.indexOf(s) !== i);
      if (duplicateInputSerials.length > 0) {
        toast.error("Duplicate serial numbers in current input", {
          description: `Please keep one value per serial. Duplicate(s): ${Array.from(new Set(duplicateInputSerials)).join(", ")}`,
        });
        return;
      }
      const alreadyInBooking = normalizedInputSerials.filter((s) => existingBookingSerialSet.has(s));
      if (alreadyInBooking.length > 0) {
        toast.error("Serial number already exists in this booking", {
          description: `Existing serial(s): ${Array.from(new Set(alreadyInBooking)).join(", ")}`,
        });
        return;
      }

      if (parsedSerialNumbers.length !== quantity) {
        toast.error("Serial numbers required for inventory grades", {
          description: `Enter exactly ${quantity} serial number(s) for Grade ${grade}.`,
        });
        return;
      }
      if (categoryRequiresImei(asset.categoryName || "")) {
        if (parsedImeiNumbers.length !== quantity) {
          toast.error("IMEI required for this category", {
            description: `Enter exactly ${quantity} IMEI(s) for ${asset.categoryName}.`,
          });
          return;
        }
      }
    }

    const resaleValue = await calculateResaleValueFn(asset.categoryName || asset.categoryId, grade, quantity);

    createRecord.mutate(
      {
        bookingId: id,
        assetId: selectedAssetId,
        assetCategory: asset.categoryName || asset.categoryId, // Use category name, fallback to ID
        grade,
        gradedBy: user.id,
        condition: isItadBooking || isAccessoryCategory ? undefined : (finalCondition || undefined),
        notes: notes || undefined,
        quantity,
        serialNumbers: !isItadBooking && ['A', 'B', 'C'].includes(grade) ? parsedSerialNumbers : [],
        imeiNumbers:
          !isItadBooking &&
          ['A', 'B', 'C'].includes(grade) && categoryRequiresImei(asset.categoryName || "")
            ? parsedImeiNumbers
            : undefined,
      },
      {
        onSuccess: () => {
          toast.success("Grading record created successfully!", {
            description: `Resale value calculated: £${resaleValue.toLocaleString()}`,
          });
          setShowForm(false);
          setSelectedAssetId("");
          setGrade("");
          setCondition("");
          setNotes("");
          setQuantity(1);
          setSerialNumbersText("");
          setSerialImeiPairs([{ serial: "", imei: "" }]);
          setSerialDbLookup({});
          setSerialLookupLoading({});
        },
        onError: (error) => {
          toast.error("Failed to create grading record", {
            description: error instanceof Error ? error.message : "Please try again.",
          });
        },
      }
    );
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

  const isMoverAtWarehouse =
    booking.bookingType === 'jml' &&
    booking.jmlSubType === 'mover' &&
    booking.status === 'warehouse';

  if (
    booking.status !== 'sanitised' &&
    booking.status !== 'graded' &&
    booking.status !== 'completed' &&
    !isMoverAtWarehouse
  ) {
    return (
      <div className="space-y-6">
        <Alert>
          <AlertDescription>
            Grading can only be performed on sanitised or graded bookings (JML mover: at warehouse). Current status:{' '}
            {booking.status}
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

  const totalResaleValue = records.reduce((sum, r) => sum + (r.resaleValue * (r.quantity || 1)), 0);

  // Require at least one job asset; `[].every(...)` is vacuously true and would show the button too early (e.g. some mover payloads).
  const allAssetsGraded =
    Array.isArray(booking?.assets) &&
    booking.assets.length > 0 &&
    booking.assets.every((asset) => {
      const gradedQty = records
        .filter((r) => r.assetId === asset.categoryId)
        .reduce((s, r) => s + (r.quantity || 0), 0);
      return gradedQty >= asset.quantity;
    });

  const isJmlInventoryAfterGrading =
    booking.bookingType === 'jml' &&
    (booking.jmlSubType === 'leaver' ||
      booking.jmlSubType === 'breakfix' ||
      booking.jmlSubType === 'mover');
  const isJmlMover = booking.bookingType === 'jml' && booking.jmlSubType === 'mover';

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
          <p className="text-muted-foreground">{booking.bookingNumber} - {booking.organisationName || booking.clientName}</p>
          </div>
        </div>
        {!showForm && (
          <Button variant="default" onClick={() => setShowForm(true)} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Grade Asset
          </Button>
        )}
      </motion.div>

      {/* Summary Card */}
      <Card className="bg-accent/5 border-accent/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Resale Value</p>
              <p className="text-3xl font-bold">£{totalResaleValue.toLocaleString()}</p>
            </div>
            <PoundSterling className="h-8 w-8 text-accent" />
          </div>
          {allAssetsGraded &&
            (booking.status === 'sanitised' ||
              booking.status === 'graded' ||
              isMoverAtWarehouse) && (
            <div className="mt-4 pt-4 border-t border-accent/20">
              <Button 
                variant="success" 
                size="lg"
                className="w-full" 
                onClick={() => {
                  if (!id) return;
                  // Mover at warehouse → graded (same as sanitised → graded). Then graded → inventory for JML inventory leg or completed for ITAD.
                  const nextStatus =
                    booking.status === 'sanitised' || isMoverAtWarehouse
                      ? 'graded'
                      : isJmlInventoryAfterGrading
                        ? 'inventory'
                        : 'completed';
                  const targetPath = isJmlMover
                    ? `/admin/booking-inventory/${id}`
                    : isJmlInventoryAfterGrading
                      ? `/admin/booking-inventory/${id}`
                      : `/booking-review/${id}`;
                  updateBookingStatus.mutate(
                    { bookingId: id, status: nextStatus },
                    {
                      onSuccess: () => {
                        toast.success(`Booking moved to ${nextStatus} status`, {
                          description: nextStatus === 'graded' ? "All assets have been graded. Proceeding to next step." : "All assets have been graded.",
                        });
                        navigate(targetPath);
                      },
                      onError: (error) => {
                        toast.error("Failed to update booking status", {
                          description: error instanceof Error ? error.message : "Please try again.",
                        });
                      },
                    }
                  );
                }}
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
                    {booking.status === 'sanitised' || isMoverAtWarehouse
                      ? 'Approve & Mark Graded'
                      : isJmlInventoryAfterGrading
                        ? 'Approve & Move to Inventory'
                        : 'Approve & Complete'}
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Record Form */}
      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Grade Asset</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="asset">Asset Category</Label>
                <Select value={selectedAssetId} onValueChange={(v) => {
                  setSelectedAssetId(v);
                  setQuantity(1);
                  setSerialNumbersText("");
                  setSerialImeiPairs([{ serial: "", imei: "" }]);
                  setSerialDbLookup({});
                  setSerialLookupLoading({});
                }}>
                  <SelectTrigger id="asset">
                    <SelectValue placeholder="Select asset category..." />
                  </SelectTrigger>
                  <SelectContent>
                    {booking.assets.map((asset) => (
                      <SelectItem key={asset.categoryId} value={asset.categoryId}>
                        {asset.categoryName} ({asset.quantity} units
                        {recordsByAsset[asset.categoryId]?.length
                          ? ` • ${recordsByAsset[asset.categoryId].reduce((s, r) => s + (r.quantity || 0), 0)}/${asset.quantity} graded`
                          : ''}
                        )
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="grade">Grade *</Label>
                <Select value={grade} onValueChange={(v) => { if (isGradeValue(v)) setGrade(v); }}>
                  <SelectTrigger id="grade">
                    <SelectValue placeholder="Select grade..." />
                  </SelectTrigger>
                  <SelectContent>
                    {grades.map((g) => (
                      <SelectItem key={g.value} value={g.value}>
                        {g.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedAssetId && grade && (
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-sm text-muted-foreground">Estimated Resale Value</p>
                  <p className="text-xl font-bold">
                    £{estimatedResaleValue.toLocaleString()}
                  </p>
                </div>
              )}

              {(!isAbcInventoryGrade || !useSerialImeiPairing) && (
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min={1}
                    max={Math.max(1, remainingQtyForSelected || 1)}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Math.floor(Number(e.target.value || 1))))}
                    disabled={!selectedAssetId}
                  />
                  {selectedAssetId && (
                    <p className="text-xs text-muted-foreground">
                      Remaining ungraded: {remainingQtyForSelected}
                    </p>
                  )}
                </div>
              )}

              {!isItadBooking && !isSelectedAssetAccessory && (!isAbcInventoryGrade || !useSerialImeiPairing) && (
                <div className="space-y-2">
                  <Label htmlFor="condition">Condition Code *</Label>
                  <Input
                    id="condition"
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                    placeholder={autoConditionCode ? autoConditionCode : "Auto-generated from device make + grade (e.g., DELA)"}
                    disabled={!!autoConditionCode}
                  />
                  {autoConditionCode ? (
                    <p className="text-xs text-muted-foreground">
                      Auto-generated from device make + grade.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Rule: first 3 letters of device make + grade (e.g., DELL + A → DELA).
                    </p>
                  )}
                </div>
              )}

              {!isItadBooking && isAbcInventoryGrade && useSerialImeiPairing && (
                <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Smartphone className="h-5 w-5" aria-hidden />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <Label className="text-base">Serial & IMEI (one row per device)</Label>
                      <p className="text-muted-foreground text-xs leading-relaxed">
                        Each row is one device: serial and IMEI are saved together. Use{" "}
                        <span className="font-medium text-foreground">Add device</span> or{" "}
                        <span className="font-medium text-foreground">remove</span> below to change how many devices
                        are in this grade — up to {maxDevicesThisSubmission} for this booking (matches{" "}
                        <span className="font-medium text-foreground">Quantity</span>).
                      </p>
                    </div>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-12 text-muted-foreground">#</TableHead>
                        <TableHead>Serial number *</TableHead>
                        <TableHead>IMEI *</TableHead>
                        <TableHead className="w-12 p-2 text-right">
                          <span className="sr-only">Remove row</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {serialImeiPairs.map((row, index) => (
                        <TableRow key={index} className="hover:bg-muted/40">
                          <TableCell className="align-middle text-muted-foreground font-medium tabular-nums">
                            {index + 1}
                          </TableCell>
                          <TableCell className="align-middle">
                            <Input
                              id={`serial-pair-${index}`}
                              value={row.serial}
                              onChange={(e) => updateSerialImeiPair(index, "serial", e.target.value)}
                              onBlur={() => void fetchSerialLookup(row.serial)}
                              placeholder="Serial or asset tag from device"
                              className="font-mono"
                              autoComplete="off"
                              aria-label={`Serial number for device ${index + 1}`}
                            />
                          </TableCell>
                          <TableCell className="align-middle">
                            <Input
                              id={`imei-pair-${index}`}
                              value={row.imei}
                              onChange={(e) => updateSerialImeiPair(index, "imei", e.target.value)}
                              placeholder="IMEI — 15 digits (phone *#06#)"
                              className="font-mono"
                              inputMode="numeric"
                              autoComplete="off"
                              aria-label={`IMEI for device ${index + 1}`}
                            />
                          </TableCell>
                          <TableCell className="align-middle text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 text-muted-foreground hover:text-destructive"
                              disabled={serialImeiPairs.length <= 1}
                              onClick={() => removeSerialImeiRow(index)}
                              aria-label={`Remove device row ${index + 1}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="space-y-3">
                    {serialImeiPairs.map((row, index) => {
                      const key = row.serial.trim().toLowerCase();
                      if (!key) return null;
                      const lookup = serialDbLookup[key];
                      const loading = serialLookupLoading[key];
                      const mismatches = compareGradingSerialVsInventory(
                        {
                          category: selectedAsset?.categoryName || "",
                          make: selectedAssetDevice?.make,
                          model: selectedAssetDevice?.model,
                          deviceType: selectedAssetDevice?.deviceType,
                          imei: row.imei,
                          isAccessory: isSelectedAssetAccessory,
                        },
                        lookup ?? null
                      );
                      const imeiMismatch = mismatches.some((m) => m.field === "IMEI");
                      const showPanel = loading || (lookup && lookup.found);
                      if (!showPanel) return null;
                      return (
                        <div
                          key={`serial-lookup-${index}-${key}`}
                          className="rounded-md border border-dashed border-border/80 bg-background/60 p-3"
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <p className="text-xs font-medium text-muted-foreground">
                              Row {index + 1} · {row.serial}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {lookup?.found && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => startEditingInventoryForSerial(key, lookup)}
                                >
                                  Edit database details
                                </Button>
                              )}
                              {imeiMismatch &&
                                lookup?.found &&
                                lookup.inventory.imei?.trim() && (
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    className="shrink-0"
                                    onClick={() =>
                                      updateSerialImeiPair(index, "imei", lookup.inventory.imei!.trim())
                                    }
                                  >
                                    Apply database IMEI
                                  </Button>
                                )}
                            </div>
                          </div>
                          {editingInventoryBySerial[key] && lookup?.found && (
                            <div className="grid gap-2 sm:grid-cols-2 rounded-md border bg-background/80 p-3 mb-3">
                              <div className="space-y-1">
                                <Label className="text-xs">Make</Label>
                                <Input
                                  value={editingInventoryDraftBySerial[key]?.make || ""}
                                  onChange={(e) =>
                                    setEditingInventoryDraftBySerial((prev) => ({
                                      ...prev,
                                      [key]: { ...(prev[key] || { make: "", model: "", deviceType: "", imei: "" }), make: e.target.value },
                                    }))
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Model</Label>
                                <Input
                                  value={editingInventoryDraftBySerial[key]?.model || ""}
                                  onChange={(e) =>
                                    setEditingInventoryDraftBySerial((prev) => ({
                                      ...prev,
                                      [key]: { ...(prev[key] || { make: "", model: "", deviceType: "", imei: "" }), model: e.target.value },
                                    }))
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Device Type</Label>
                                <Input
                                  value={editingInventoryDraftBySerial[key]?.deviceType || ""}
                                  onChange={(e) =>
                                    setEditingInventoryDraftBySerial((prev) => ({
                                      ...prev,
                                      [key]: { ...(prev[key] || { make: "", model: "", deviceType: "", imei: "" }), deviceType: e.target.value },
                                    }))
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">IMEI (if exists)</Label>
                                <Input
                                  value={editingInventoryDraftBySerial[key]?.imei || ""}
                                  onChange={(e) =>
                                    setEditingInventoryDraftBySerial((prev) => ({
                                      ...prev,
                                      [key]: { ...(prev[key] || { make: "", model: "", deviceType: "", imei: "" }), imei: e.target.value },
                                    }))
                                  }
                                />
                              </div>
                              <div className="sm:col-span-2 flex gap-2 justify-end">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    setEditingInventoryBySerial((prev) => ({ ...prev, [key]: false }))
                                  }
                                >
                                  Cancel
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => void saveInventoryEditsForSerial(key)}
                                  disabled={!!savingInventoryBySerial[key]}
                                >
                                  {savingInventoryBySerial[key] ? "Saving..." : "Save DB details"}
                                </Button>
                              </div>
                            </div>
                          )}
                          <SerialInventorySnapshot
                            lookup={lookup ?? null}
                            mismatches={mismatches}
                            loading={loading}
                            variant="grading"
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto"
                      onClick={addSerialImeiRow}
                      disabled={quantity >= maxDevicesThisSubmission}
                    >
                      <Plus className="h-4 w-4" />
                      Add device
                    </Button>
                    <p className="text-muted-foreground text-xs sm:text-right">
                      {quantity} of {maxDevicesThisSubmission} device{maxDevicesThisSubmission !== 1 ? "s" : ""} in this
                      entry
                    </p>
                  </div>
                </div>
              )}

              {!isItadBooking && isAbcInventoryGrade && useSerialImeiPairing && !isSelectedAssetAccessory && (
                <div className="space-y-2">
                  <Label htmlFor="condition">Condition Code *</Label>
                  <Input
                    id="condition"
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                    placeholder={autoConditionCode ? autoConditionCode : "Auto-generated from device make + grade (e.g., DELA)"}
                    disabled={!!autoConditionCode}
                  />
                  {autoConditionCode ? (
                    <p className="text-xs text-muted-foreground">
                      Auto-generated from device make + grade.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Rule: first 3 letters of device make + grade (e.g., DELL + A → DELA).
                    </p>
                  )}
                </div>
              )}

              {!isItadBooking && isAbcInventoryGrade && !useSerialImeiPairing && (
                <div className="space-y-2">
                  <Label htmlFor="serialInput">Serial Numbers *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="serialInput"
                      value={serialInput}
                      onChange={(e) => setSerialInput(e.target.value)}
                      placeholder={
                        parsedSerialNumbers.length >= quantity
                          ? `Maximum ${quantity} serial(s) added`
                          : "Enter serial and press Enter or Add"
                      }
                      className="font-mono"
                      disabled={parsedSerialNumbers.length >= quantity}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addSerialChip(serialInput);
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={parsedSerialNumbers.length >= quantity}
                      onClick={() => {
                        addSerialChip(serialInput);
                      }}
                    >
                      Add
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Add up to {quantity} serial number{quantity !== 1 ? "s" : ""}: {parsedSerialNumbers.length}/
                    {quantity}
                  </p>
                  {parsedSerialNumbers.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-1">
                      {parsedSerialNumbers.map((sn) => (
                        <span
                          key={sn}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-xs font-mono border"
                        >
                          {sn}
                          <button
                            type="button"
                            onClick={() => {
                              setSerialNumbersText((prev) =>
                                prev
                                  .split(/[\n,]+/g)
                                  .map((s) => s.trim())
                                  .filter(Boolean)
                                  .filter((s) => s !== sn)
                                  .join("\n")
                              );
                            }}
                            className="rounded-full p-0.5 hover:bg-muted-foreground/20 focus:outline-none focus:ring-1 focus:ring-ring"
                            aria-label={`Remove ${sn}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  {isSelectedAssetAccessory && selectedAssetDevice?.notes && (
                    <div className="rounded-md border border-border bg-background/60 p-2.5 text-xs text-muted-foreground">
                      <div className="inline-flex items-center gap-1 font-medium text-foreground mb-1">
                        <StickyNote className="h-3.5 w-3.5" />
                        Previous Memo
                      </div>
                      <p className="whitespace-pre-wrap break-words">{selectedAssetDevice.notes}</p>
                    </div>
                  )}
                  <div className="space-y-3">
                    {parsedSerialNumbers.map((serial, index) => {
                      const key = serial.trim().toLowerCase();
                      const lookup = serialDbLookup[key];
                      const loading = serialLookupLoading[key];
                      const mismatches = compareGradingSerialVsInventory(
                        {
                          category: selectedAsset?.categoryName || "",
                          make: selectedAssetDevice?.make,
                          model: selectedAssetDevice?.model,
                          deviceType: selectedAssetDevice?.deviceType,
                          isAccessory: isSelectedAssetAccessory,
                        },
                        lookup ?? null
                      );
                      const showPanel = loading || (lookup && lookup.found);
                      if (!showPanel) return null;
                      return (
                        <div
                          key={`serial-lookup-chip-${index}-${key}`}
                          className="rounded-md border border-dashed border-border/80 bg-background/60 p-3"
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-2">
                            <p className="text-xs font-medium text-muted-foreground">
                              Serial {index + 1} · {serial}
                            </p>
                            {lookup?.found && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => startEditingInventoryForSerial(key, lookup)}
                              >
                                Edit database details
                              </Button>
                            )}
                          </div>
                          {editingInventoryBySerial[key] && lookup?.found && (
                            <div className="grid gap-2 sm:grid-cols-2 rounded-md border bg-background/80 p-3 mb-3">
                              <div className="space-y-1">
                                <Label className="text-xs">Make</Label>
                                <Input
                                  value={editingInventoryDraftBySerial[key]?.make || ""}
                                  onChange={(e) =>
                                    setEditingInventoryDraftBySerial((prev) => ({
                                      ...prev,
                                      [key]: { ...(prev[key] || { make: "", model: "", deviceType: "", imei: "" }), make: e.target.value },
                                    }))
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Model</Label>
                                <Input
                                  value={editingInventoryDraftBySerial[key]?.model || ""}
                                  onChange={(e) =>
                                    setEditingInventoryDraftBySerial((prev) => ({
                                      ...prev,
                                      [key]: { ...(prev[key] || { make: "", model: "", deviceType: "", imei: "" }), model: e.target.value },
                                    }))
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Device Type</Label>
                                <Input
                                  value={editingInventoryDraftBySerial[key]?.deviceType || ""}
                                  onChange={(e) =>
                                    setEditingInventoryDraftBySerial((prev) => ({
                                      ...prev,
                                      [key]: { ...(prev[key] || { make: "", model: "", deviceType: "", imei: "" }), deviceType: e.target.value },
                                    }))
                                  }
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">IMEI (if exists)</Label>
                                <Input
                                  value={editingInventoryDraftBySerial[key]?.imei || ""}
                                  onChange={(e) =>
                                    setEditingInventoryDraftBySerial((prev) => ({
                                      ...prev,
                                      [key]: { ...(prev[key] || { make: "", model: "", deviceType: "", imei: "" }), imei: e.target.value },
                                    }))
                                  }
                                />
                              </div>
                              <div className="sm:col-span-2 flex gap-2 justify-end">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    setEditingInventoryBySerial((prev) => ({ ...prev, [key]: false }))
                                  }
                                >
                                  Cancel
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => void saveInventoryEditsForSerial(key)}
                                  disabled={!!savingInventoryBySerial[key]}
                                >
                                  {savingInventoryBySerial[key] ? "Saving..." : "Save DB details"}
                                </Button>
                              </div>
                            </div>
                          )}
                          <SerialInventorySnapshot
                            lookup={lookup ?? null}
                            mismatches={mismatches}
                            loading={loading}
                            variant="grading"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes about the grading..."
                  rows={3}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="default"
                  onClick={handleCreateRecord}
                  disabled={!selectedAssetId || !grade || createRecord.isPending}
                >
                  {createRecord.isPending ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Award />
                      Create Grade
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

      {/* Grading Records */}
      <div className="space-y-4">
        {booking.assets.map((asset) => {
          const assetRecords = recordsByAsset[asset.categoryId] || [];
          const gradedQty = assetRecords.reduce((s, r) => s + (r.quantity || 0), 0);

          return (
            <Card key={asset.categoryId}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{asset.categoryName}</CardTitle>
                  <Badge variant="secondary">{gradedQty}/{asset.quantity} units graded</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {assetRecords.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Not yet graded
                  </p>
                ) : (
                  <div className="space-y-4">
                    {assetRecords.map((r) => (
                      <div key={r.id} className="flex items-start justify-between p-4 rounded-lg border bg-muted/50">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <Award className="h-4 w-4 text-muted-foreground" />
                            <Badge className={cn("text-sm", grades.find(g => g.value === r.grade)?.color)}>
                              Grade {r.grade}
                            </Badge>
                            <Badge variant="outline">{r.quantity} unit{r.quantity === 1 ? '' : 's'}</Badge>
                          </div>
                          <div className="text-sm space-y-1">
                            <p>
                              <span className="text-muted-foreground">Resale Value:</span>{" "}
                              <span className="font-semibold text-foreground">£{r.resaleValue.toLocaleString()} per unit</span>
                            </p>
                            <p>
                              <span className="text-muted-foreground">Total Value:</span>{" "}
                              <span className="font-semibold text-foreground">£{(r.resaleValue * (r.quantity || 1)).toLocaleString()}</span>
                            </p>
                            <p>
                              <span className="text-muted-foreground">Graded:</span>{" "}
                              <span className="text-foreground">{new Date(r.gradedAt).toLocaleString("en-GB")}</span>
                            </p>
                            {!isItadBooking && ((asset.categoryName || "").trim().toLowerCase().includes("accessor") === false) && r.condition && (
                              <p><span className="text-muted-foreground">Condition:</span> <span className="text-foreground">{r.condition}</span></p>
                            )}
                            {!isItadBooking && (() => {
                              const sns = r.serialNumbers || [];
                              const ims = r.imeiNumbers || [];
                              if (sns.length > 0 && ims.length === sns.length) {
                                return (
                                  <div className="space-y-2 pt-1">
                                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                      Serial ↔ IMEI
                                    </p>
                                    <ul className="space-y-2">
                                      {sns.map((sn, idx) => (
                                        <li
                                          key={`${r.id}-pair-${idx}`}
                                          className="rounded-md border border-border bg-background/80 px-3 py-2 text-sm"
                                        >
                                          <div className="grid gap-1 sm:grid-cols-2 sm:gap-4">
                                            <div>
                                              <span className="text-muted-foreground">Serial</span>
                                              <p className="font-mono text-foreground">{sn}</p>
                                            </div>
                                            <div>
                                              <span className="text-muted-foreground">IMEI</span>
                                              <p className="font-mono text-foreground">{ims[idx]}</p>
                                            </div>
                                          </div>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                );
                              }
                              if (sns.length > 0) {
                                return (
                                  <p>
                                    <span className="text-muted-foreground">Serials:</span>{" "}
                                    <span className="text-foreground font-mono">{sns.join(", ")}</span>
                                  </p>
                                );
                              }
                              if (ims.length > 0) {
                                return (
                                  <p>
                                    <span className="text-muted-foreground">IMEI:</span>{" "}
                                    <span className="text-foreground font-mono">{ims.join(", ")}</span>
                                  </p>
                                );
                              }
                              return null;
                            })()}
                            {r.notes && (
                              <p><span className="text-muted-foreground">Notes:</span> <span className="text-foreground">{r.notes}</span></p>
                            )}
                          </div>
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
    </div>
  );
};

export default Grading;

