import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Search, Calendar, MapPin, Package, ArrowRight, Loader2, Truck, Route, Fuel, User, UserPlus, UserCog, PackageSearch, Pencil, MoreHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { useBookings, useUpdateBookingStatus, useUpdateScheduledDate } from "@/hooks/useBookings";
import { useJob } from "@/hooks/useJobs";
import { useDrivers } from "@/hooks/useDrivers";
import { useReassignDriver } from "@/hooks/useJobs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getStatusLabelExtended, getStatusColor, getStatusLabel } from "@/types/booking-lifecycle";
import type { BookingLifecycleStatus } from "@/types/booking-lifecycle";
import { BookingTypeBadge } from "@/components/bookings/BookingTypeBadge";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { formatDate } from '@/lib/datetime';
import { ListPagination } from "@/components/common/ListPagination";
import { ViewModeToggle } from "@/components/common/ViewModeToggle";
import { usePersistedViewMode } from "@/hooks/usePersistedViewMode";
import { useClientPagination } from "@/hooks/useClientPagination";

// Group order and status mapping (aligned with ITAD / New Starter / Leaver / Breakfix / Mover flows)
const statusGroups: { label: string; statuses: (BookingLifecycleStatus | 'cancelled')[] }[] = [
  { label: "Pending", statuses: ['pending'] },
  { label: "Created", statuses: ['created'] },
  { label: "Device allocated", statuses: ['device_allocated'] },
  { label: "Scheduled", statuses: ['scheduled', 'collection_scheduled', 'courier_booked', 'dispatched'] },
  { label: "Collected", statuses: ['collected'] },
  { label: "Delivered", statuses: ['delivered'] },
  { label: "In Progress", statuses: ['warehouse', 'sanitised', 'graded', 'inventory'] },
  { label: "Completed", statuses: ['completed'] },
  { label: "Cancelled", statuses: ['cancelled'] },
];
const FREE_COURIER_MAX_ITEMS = 5;

const isFreeCourierBooking = (booking: {
  bookingType?: "itad_collection" | "free_collection" | "jml" | null;
  assets?: Array<{ categoryName?: string; quantity: number }>;
}) => {
  if (booking.bookingType === "free_collection") {
    return true;
  }
  if (booking.bookingType && booking.bookingType !== "itad_collection") {
    return false;
  }

  const assets = booking.assets || [];
  if (assets.length === 0) return false;

  const totalUnits = assets.reduce((sum, asset) => sum + (asset.quantity || 0), 0);
  if (totalUnits <= 0 || totalUnits > FREE_COURIER_MAX_ITEMS) return false;

  return assets.every((asset) => {
    const categoryName = (asset.categoryName || "").toLowerCase();
    return categoryName.includes("phone") || categoryName.includes("laptop");
  });
};

// Determine the single logical next status for a booking
// This respects different workflows (ITAD, New Starter, Leaver, Breakfix, Mover)
const getNextStatusForBooking = (booking: {
  status: BookingLifecycleStatus | "cancelled";
  bookingType?: "itad_collection" | "free_collection" | "jml" | null;
  jmlSubType?: "new_starter" | "leaver" | "breakfix" | "mover" | null;
}): BookingLifecycleStatus | null => {
  const { status, bookingType, jmlSubType } = booking;

  // No next status for terminal states
  if (status === "completed" || status === "cancelled") return null;

  // Created, device_allocated, warehouse, sanitised, graded are driven by
  // explicit actions (Assign Driver, Allocate Device, Record Sanitisation, Grade Assets, Final Approval)
  if (
    status === "created" ||
    status === "warehouse" ||
    status === "sanitised"
  ) {
    return null;
  }

  // ITAD collection (non-JML)
  const isItad = !bookingType || bookingType === "itad_collection";
  const isFreeCollection = bookingType === "free_collection";
  const isJml = bookingType === "jml";

  if (isItad) {
    switch (status) {
      // ITAD: allow admin to progress workflow without driver actions.
      // scheduled -> collected (fast-forwards job milestones), collected -> warehouse.
      case "scheduled":
        return "collected";
      case "collected":
        return "warehouse";
      case "graded":
        return "completed";
      default:
        return null;
    }
  }

  if (isFreeCollection) {
    switch (status) {
      case "collection_scheduled":
        return "collected";
      case "collected":
        return "warehouse";
      case "graded":
        return "inventory";
      case "inventory":
        return "completed";
      default:
        return null;
    }
  }

  // JML flows
  if (isJml) {
    switch (jmlSubType) {
      case "new_starter":
        switch (status) {
          // Created → device_allocated (Allocate Device button)
          // device_allocated → courier_booked (Book Courier button)
          case "courier_booked":
            return "dispatched";
          case "dispatched":
            return "delivered";
          case "delivered":
            return "completed";
          default:
            return null;
        }
      case "leaver":
        switch (status) {
          // Created → collection_scheduled (Book Courier button)
          case "collection_scheduled":
            return "collected";
          case "collected":
            return "warehouse";
          case "graded":
            return "inventory";
          case "inventory":
            return "completed";
          default:
            return null;
        }
      case "breakfix":
        switch (status) {
          // Created → device_allocated (Allocate Device button)
          // device_allocated → courier_booked (Book Courier button)
          case "courier_booked":
            return "dispatched";
          case "dispatched":
            return "delivered";
          case "delivered":
            return "collected"; // Broken device collected
          case "collected":
            return "warehouse";
          case "graded":
            return "inventory";
          case "inventory":
            return "completed";
          default:
            return null;
        }
      case "mover":
        switch (status) {
          // Created → collection_scheduled (Book Courier button)
          case "collection_scheduled":
            return "collected";
          case "collected":
            return "warehouse";
          case "graded":
            return "inventory";
          case "inventory":
            return "device_allocated";
          case "device_allocated":
            return "courier_booked";
          case "courier_booked":
            return "dispatched";
          case "dispatched":
            return "delivered";
          case "delivered":
            return "completed";
          default:
            return null;
        }
      default:
        return null;
    }
  }

  return null;
};

const getBookingSequence = (booking: {
  bookingType?: "itad_collection" | "free_collection" | "jml" | null;
  jmlSubType?: "new_starter" | "leaver" | "breakfix" | "mover" | null;
}): BookingLifecycleStatus[] => {
  if (!booking.bookingType || booking.bookingType === "itad_collection") {
    return ["pending", "created", "scheduled", "collected", "warehouse", "sanitised", "graded", "completed"];
  }
  if (booking.bookingType === "free_collection") {
    return ["pending", "created", "collection_scheduled", "collected", "warehouse", "sanitised", "graded", "inventory", "completed"];
  }
  if (booking.jmlSubType === "new_starter") {
    return ["pending", "created", "device_allocated", "courier_booked", "dispatched", "delivered", "completed"];
  }
  if (booking.jmlSubType === "leaver") {
    return ["pending", "created", "collection_scheduled", "collected", "warehouse", "sanitised", "graded", "inventory", "completed"];
  }
  if (booking.jmlSubType === "mover") {
    return ["pending", "created", "collection_scheduled", "collected", "warehouse", "graded", "inventory", "device_allocated", "courier_booked", "dispatched", "delivered", "completed"];
  }
  return ["pending", "created", "device_allocated", "courier_booked", "dispatched", "delivered", "collected", "warehouse", "sanitised", "graded", "inventory", "completed"];
};

const BookingQueue = () => {
  const { user: currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusGroup, setStatusGroup] = useState<string>("all");
  const [reassignBookingId, setReassignBookingId] = useState<string | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string>("");
  const [editDateBookingId, setEditDateBookingId] = useState<string | null>(null);
  const [newScheduledDate, setNewScheduledDate] = useState<string>("");
  const [viewMode, setViewMode] = usePersistedViewMode("booking-queue-view", "card");

  const { data: bookings = [], isLoading, error } = useBookings();
  const { data: drivers = [] } = useDrivers();
  const updateBookingStatus = useUpdateBookingStatus();
  const updateScheduledDate = useUpdateScheduledDate();
  const reassignDriver = useReassignDriver();
  
  // Filter out drivers without allocated vehicles
  const driversWithVehicles = drivers.filter(driver => driver.hasVehicle && (driver.vehicleReg || (driver.vehicles && driver.vehicles.length > 0)));
  
  // Get job for the booking being re-assigned
  const bookingToReassign = bookings.find(b => b.id === reassignBookingId);
  const { data: relatedJob } = useJob(bookingToReassign?.jobId || null);
  const getCurrentDriverVehicleSelection = (): string | null => {
    if (!relatedJob?.driver) return null;
    const currentDriver = driversWithVehicles.find(d => d.id === relatedJob.driver?.id);
    if (!currentDriver) return null;
    const matchedVehicle =
      currentDriver.vehicles?.find(v => v.vehicleReg === relatedJob.driver?.vehicleReg) ||
      (currentDriver.vehicleReg === relatedJob.driver?.vehicleReg && currentDriver.vehicleId
        ? { id: currentDriver.vehicleId, vehicleReg: currentDriver.vehicleReg, vehicleType: currentDriver.vehicleType || 'van', vehicleFuelType: currentDriver.vehicleFuelType || 'diesel' }
        : null);
    if (!matchedVehicle?.id) return null;
    return `${currentDriver.id}:${matchedVehicle.id}`;
  };

  const handleUpdateStatus = (bookingId: string, status: BookingLifecycleStatus | 'cancelled') => {
    updateBookingStatus.mutate(
      { bookingId, status, notes: undefined },
      {
        onSuccess: () => {
          const label = status === 'cancelled' ? 'Cancelled' : getStatusLabel(status as BookingLifecycleStatus);
          toast.success("Status updated", {
            description: `Booking moved to ${label}.`,
          });
        },
        onError: (error) => {
          toast.error("Failed to update booking status", {
            description: error instanceof Error ? error.message : "Please try again.",
          });
        },
      }
    );
  };

  const openEditDateDialog = (bookingId: string, currentScheduledDate: string) => {
    setEditDateBookingId(bookingId);
    setNewScheduledDate(new Date(currentScheduledDate).toISOString().slice(0, 10));
  };

  const closeEditDateDialog = () => {
    setEditDateBookingId(null);
    setNewScheduledDate("");
  };

  const filteredBookings = bookings.filter((booking) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (booking.organisationName || '').toLowerCase().includes(q) ||
      booking.clientName.toLowerCase().includes(q) ||
      booking.bookingNumber.toLowerCase().includes(q) ||
      booking.siteName.toLowerCase().includes(q);
    
    const matchesStatus = statusGroup === "all" || 
      statusGroups.find(g => g.label === statusGroup)?.statuses.includes(booking.status);
    
    return matchesSearch && matchesStatus;
  });

  const { pagination, pagedItems, setPage, setLimit } = useClientPagination(
    filteredBookings,
    `${searchQuery}|${statusGroup}`
  );

  // Group current page of bookings by status
  const groupedBookings = statusGroups.reduce((acc, group) => {
    const groupBookings = pagedItems.filter(b => group.statuses.includes(b.status));
    if (groupBookings.length > 0) {
      acc[group.label] = groupBookings;
    }
    return acc;
  }, {} as Record<string, typeof filteredBookings>);

  // Include any bookings that don't match any status group (safety net)
  const allStatusesInGroups = new Set(statusGroups.flatMap(g => g.statuses));
  const ungroupedBookings = pagedItems.filter(b => !allStatusesInGroups.has(b.status));
  if (ungroupedBookings.length > 0) {
    groupedBookings['Other'] = ungroupedBookings;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertDescription>Failed to load bookings. Please try refreshing the page.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Subtitle only — page title comes from AppLayout */}
      <motion.p
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-muted-foreground"
      >
        Manage and assign bookings by status
      </motion.p>

      {/* Search and Filters */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col sm:flex-row gap-4"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by client, booking number, or site..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusGroup} onValueChange={setStatusGroup}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="All Groups" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Groups</SelectItem>
            {statusGroups.map((group) => (
              <SelectItem key={group.label} value={group.label}>
                {group.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ViewModeToggle value={viewMode} onChange={setViewMode} className="self-end sm:self-auto" />
      </motion.div>

      {/* Bookings by Status Group */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="text-center py-12">
          <Package className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No bookings found matching your criteria</p>
        </div>
      ) : (
        <div className="space-y-6">
          {statusGroups.map((group) => {
            const groupBookings = groupedBookings[group.label];
            if (!groupBookings || groupBookings.length === 0) return null;

            return (
              <motion.div
                key={group.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-foreground">{group.label}</h3>
                  <Badge variant="secondary">{groupBookings.length}</Badge>
                </div>
                <div className={viewMode === "list" ? "space-y-2" : "grid gap-3 md:grid-cols-2 lg:grid-cols-3"}>
                  {groupBookings.map((booking, index) => {
                    const statusColor = getStatusColor(booking.status);
                    const statusLabel = getStatusLabelExtended(booking.status, booking.bookingType);
                    const actionBtnClass = viewMode === "card" ? "w-full mt-2" : undefined;
                    const canEditScheduledDate =
                      booking.status === "created" ||
                      booking.status === "scheduled" ||
                      booking.status === "collection_scheduled" ||
                      booking.status === "courier_booked";
                    const canReassignDriver =
                      booking.status === "scheduled" &&
                      !!booking.jobId &&
                      booking.jobStatus === "routed" &&
                      booking.bookingType !== "jml";
                    const sequence = getBookingSequence(booking);
                    const currentIndex = sequence.findIndex((s) => s === booking.status);
                    const rollbackStatuses =
                      currentUser?.isSuperAdmin && currentIndex > 0
                        ? sequence.slice(0, currentIndex).reverse()
                        : [];
                    const nextStatus = getNextStatusForBooking(booking);

                    const bookingActions = (
                      <>
                        <div className={viewMode === "card" ? "flex items-center gap-2 mt-2" : "flex items-center gap-2"}>
                          <Button variant="outline" asChild className={viewMode === "card" ? "flex-1" : undefined} size="sm">
                            <Link to={`/bookings/${booking.id}`} className="text-inherit no-underline">
                              View Details
                              <ArrowRight className="h-4 w-4 ml-2" />
                            </Link>
                          </Button>
                          {(canEditScheduledDate || canReassignDriver || rollbackStatuses.length > 0) && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="icon" aria-label="More actions">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {canEditScheduledDate && (
                                  <DropdownMenuItem
                                    onClick={() => openEditDateDialog(booking.id, booking.scheduledDate)}
                                  >
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Change Schedule Date
                                  </DropdownMenuItem>
                                )}
                                {canReassignDriver && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setReassignBookingId(booking.id);
                                      setSelectedDriverId("");
                                    }}
                                    disabled={reassignDriver.isPending}
                                  >
                                    <UserCog className="h-4 w-4 mr-2" />
                                    Re-assign Driver
                                  </DropdownMenuItem>
                                )}
                                {rollbackStatuses.map((rollbackStatus) => (
                                  <DropdownMenuItem
                                    key={`${booking.id}-${rollbackStatus}`}
                                    onClick={() => handleUpdateStatus(booking.id, rollbackStatus)}
                                    disabled={updateBookingStatus.isPending}
                                  >
                                    Move back to {getStatusLabel(rollbackStatus)}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                        {booking.status === 'pending' && (
                          <Button variant="default" asChild className={actionBtnClass} size="sm">
                            <Link to={`/admin/booking-approval/${booking.id}`} className="text-inherit no-underline">
                              Review & Approve
                            </Link>
                          </Button>
                        )}
                        {/* Only show Assign Driver for ITAD bookings - explicitly exclude JML */}
                        {booking.status === 'created' &&
                         booking.bookingType !== 'jml' &&
                         !isFreeCourierBooking(booking) &&
                         (booking.bookingType === 'itad_collection' || booking.bookingType === undefined || booking.bookingType === null) && (
                          <Button variant="default" asChild className={actionBtnClass} size="sm">
                            <Link to={`/admin/assign?booking=${booking.id}`} className="text-inherit no-underline">
                              <UserPlus />
                              Assign Driver
                            </Link>
                          </Button>
                        )}
                        {/* Free Collection (ITAD courier-like): created -> book courier, no driver assignment */}
                        {booking.status === 'created' &&
                          isFreeCourierBooking(booking) && (
                          <Button variant="default" asChild className={actionBtnClass} size="sm">
                            <Link to={`/admin/assign?booking=${booking.id}`} className="text-inherit no-underline">
                              <PackageSearch />
                              Book Courier
                            </Link>
                          </Button>
                        )}
                        {/* Show Allocate Device for new_starter and breakfix in created status */}
                        {booking.status === 'created' &&
                          booking.bookingType === 'jml' &&
                          (booking.jmlSubType === 'new_starter' || booking.jmlSubType === 'breakfix') && (
                          <Button variant="default" asChild className={actionBtnClass} size="sm">
                            <Link to={`/admin/device-allocation?booking=${booking.id}`} className="text-inherit no-underline">
                              <Package />
                              Allocate Device
                            </Link>
                          </Button>
                        )}
                        {/* Show Book Courier for JML bookings in device_allocated status */}
                        {booking.status === 'device_allocated' &&
                          booking.bookingType === 'jml' && (
                          <Button variant="default" asChild className={actionBtnClass} size="sm">
                            <Link to={`/admin/assign?booking=${booking.id}`} className="text-inherit no-underline">
                              <PackageSearch />
                              Book Courier
                            </Link>
                          </Button>
                        )}
                        {/* Show Book Courier for leaver and mover in created status (no device allocation needed) */}
                        {booking.status === 'created' &&
                          booking.bookingType === 'jml' &&
                          (booking.jmlSubType === 'leaver' || booking.jmlSubType === 'mover') && (
                          <Button variant="default" asChild className={actionBtnClass} size="sm">
                            <Link to={`/admin/assign?booking=${booking.id}`} className="text-inherit no-underline">
                              <PackageSearch />
                              Book Courier
                            </Link>
                          </Button>
                        )}
                        {booking.status === 'warehouse' &&
                          (booking.bookingType === 'jml' && booking.jmlSubType === 'mover' ? (
                            <Button asChild className={actionBtnClass} size="sm" variant="default">
                              <Link to={`/admin/grading/${booking.id}`} className="text-inherit no-underline">
                                Grade Assets
                              </Link>
                            </Button>
                          ) : (
                            <Button asChild className={actionBtnClass} size="sm" variant="default">
                              <Link to={`/admin/sanitisation/${booking.id}`} className="text-inherit no-underline">
                                Record Sanitisation
                              </Link>
                            </Button>
                          ))}
                        {booking.status === 'sanitised' && (
                          <Button asChild className={actionBtnClass} size="sm" variant="default">
                            <Link to={`/admin/grading/${booking.id}`} className="text-inherit no-underline">
                              Grade Assets
                            </Link>
                          </Button>
                        )}
                        {booking.status === 'graded' &&
                          booking.bookingType === 'jml' &&
                          (booking.jmlSubType === 'leaver' ||
                            booking.jmlSubType === 'breakfix' ||
                            booking.jmlSubType === 'mover') && (
                          <Button asChild className={actionBtnClass} size="sm" variant="default">
                            <Link to={`/admin/booking-inventory/${booking.id}`} className="text-inherit no-underline">
                              Add to Inventory List
                            </Link>
                          </Button>
                        )}
                        {/* Next-step button: for inventory status nextStatus is 'completed', so dynamic block below shows Final Overview */}
                        {/* Single next-step button per status, only where there is no dedicated action */}
                        {(() => {
                          if (!nextStatus) return null;

                          // Mover at inventory: allocate all devices linked to this booking (device allocation page auto-runs)
                          if (
                            booking.bookingType === 'jml' &&
                            booking.jmlSubType === 'mover' &&
                            booking.status === 'inventory' &&
                            nextStatus === 'device_allocated'
                          ) {
                            return (
                              <Button asChild className={actionBtnClass} size="sm" variant="success">
                                <Link to={`/admin/device-allocation?booking=${booking.id}`} className="text-inherit no-underline">
                                  <Package className="h-4 w-4 mr-2 inline" />
                                  Allocate Device
                                </Link>
                              </Button>
                            );
                          }

                          // For any status that goes directly to Completed, send admin to final overview page
                          if (nextStatus === 'completed') {
                            return (
                              <Button
                                asChild
                                className={actionBtnClass}
                                size="sm"
                                variant="success"
                                disabled={updateBookingStatus.isPending}
                              >
                                <Link to={`/booking-review/${booking.id}`} className="text-inherit no-underline">
                                  Final Overview
                                </Link>
                              </Button>
                            );
                          }

                          return (
                            <Button
                              variant="default"
                              className={actionBtnClass}
                              size="sm"
                              disabled={updateBookingStatus.isPending}
                              onClick={() => handleUpdateStatus(booking.id, nextStatus)}
                            >
                              {`Move to ${getStatusLabel(nextStatus)}`}
                            </Button>
                          );
                        })()}
                      </>
                    );

                    if (viewMode === "list") {
                      return (
                        <motion.div
                          key={booking.id}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(index * 0.03, 0.15) }}
                        >
                          <Card className="hover:shadow-sm transition-shadow">
                            <CardContent className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                  <p className="truncate text-sm font-semibold text-foreground">
                                    {booking.organisationName || booking.clientName}
                                  </p>
                                  <BookingTypeBadge
                                    bookingType={booking.bookingType}
                                    jmlSubType={booking.jmlSubType}
                                    isFreeCollection={isFreeCourierBooking(booking)}
                                    size="sm"
                                  />
                                  <Badge className={statusColor}>{statusLabel}</Badge>
                                </div>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                  <span className="font-mono shrink-0">{booking.bookingNumber}</span>
                                  <span className="flex min-w-0 items-center gap-1 truncate">
                                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                                    <span className="truncate">
                                      {booking.jmlSubType === 'mover' && booking.currentAddress
                                        ? `${booking.currentSiteName || 'Current'} → ${booking.siteName}`
                                        : booking.siteName}
                                    </span>
                                  </span>
                                  <span className="flex shrink-0 items-center gap-1">
                                    <Calendar className="h-3.5 w-3.5" />
                                    {formatDate(booking.scheduledDate)}
                                  </span>
                                </div>
                              </div>
                              <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                                {bookingActions}
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      );
                    }

                    return (
                      <motion.div
                        key={booking.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Card className="hover:shadow-md transition-shadow h-full">
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <CardTitle className="text-base mb-1">{booking.organisationName || booking.clientName}</CardTitle>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-xs font-mono text-muted-foreground">{booking.bookingNumber}</p>
                                  <BookingTypeBadge
                                    bookingType={booking.bookingType}
                                    jmlSubType={booking.jmlSubType}
                                    isFreeCollection={isFreeCourierBooking(booking)}
                                    size="sm"
                                  />
                                </div>
                              </div>
                              <Badge className={statusColor}>{statusLabel}</Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {booking.createdByName && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <User className="h-4 w-4" />
                                <span className="truncate">{booking.createdByName}</span>
                              </div>
                            )}
                            {booking.jmlSubType === 'mover' && booking.currentAddress ? (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <MapPin className="h-4 w-4" />
                                  <span className="truncate text-xs">From: {booking.currentSiteName || 'Current'}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <MapPin className="h-4 w-4 text-primary" />
                                  <span className="truncate text-xs">To: {booking.siteName}</span>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <MapPin className="h-4 w-4" />
                                <span className="truncate">{booking.siteName}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="h-4 w-4" />
                              <span>{formatDate(booking.scheduledDate)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Package className="h-4 w-4" />
                              <span>{booking.assets.reduce((sum, a) => sum + a.quantity, 0)} assets</span>
                            </div>
                            {booking.roundTripDistanceKm && booking.roundTripDistanceKm > 0 && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Route className="h-4 w-4" />
                                <span>
                                  Return Journey: {booking.roundTripDistanceMiles
                                    ? `${booking.roundTripDistanceMiles.toFixed(1)} mi`
                                    : `${(booking.roundTripDistanceKm * 0.621371).toFixed(1)} mi`}
                                </span>
                              </div>
                            )}
                            {booking.bookingType === "free_collection" ? (
                              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                                <PackageSearch className="h-4 w-4 shrink-0 mt-0.5" />
                                <div className="min-w-0 space-y-1.5">
                                  <div>
                                    <p className="text-xs text-muted-foreground">Courier type</p>
                                    <p className="text-foreground font-medium break-words">
                                      {booking.courierService?.trim() ||
                                        booking.collectionCourierService?.trim() ||
                                        "—"}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">Tracking number</p>
                                    <p className="font-mono text-xs text-foreground break-all">
                                      {booking.courierTracking?.trim() ||
                                        booking.collectionCourierTracking?.trim() ||
                                        "—"}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              booking.preferredVehicleType && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Fuel className="h-4 w-4" />
                                  <span>Preferred: {booking.preferredVehicleType.charAt(0).toUpperCase() + booking.preferredVehicleType.slice(1)}</span>
                                </div>
                              )
                            )}
                            {booking.driverName && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <User className="h-4 w-4" />
                                <span>Driver: {booking.driverName}</span>
                              </div>
                            )}
                            {bookingActions}
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <ListPagination
        pagination={pagination}
        onPageChange={setPage}
        onLimitChange={setLimit}
        itemLabel="bookings"
        isLoading={isLoading}
      />

      {/* Re-assign Driver Dialog */}
      <Dialog open={!!reassignBookingId} onOpenChange={(open) => !open && setReassignBookingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Re-assign Driver</DialogTitle>
            <DialogDescription>
              Select a new driver to assign to this job, or choose to unassign the current driver. The current driver will be notified of the change.
              Only jobs with status 'routed' can be re-assigned or unassigned.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {relatedJob && relatedJob.status !== 'routed' && (
              <Alert variant="destructive">
                <AlertDescription>
                  Cannot re-assign driver. Job status must be 'routed' to re-assign. Current status: {relatedJob.status}
                </AlertDescription>
              </Alert>
            )}
            {relatedJob && relatedJob.driver && (
              <div className="space-y-2">
                <Label>Current Driver</Label>
                <div className="p-2 rounded-md bg-muted">
                  <p className="text-sm font-medium">{relatedJob.driver.name}</p>
                  {relatedJob.driver.vehicleReg && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Vehicle:</p>
                      <p className="text-xs text-muted-foreground font-mono">{relatedJob.driver.vehicleReg}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {relatedJob.driver.vehicleType} • {relatedJob.driver.vehicleFuelType}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="newDriver">New Driver</Label>
              <Select 
                value={selectedDriverId} 
                onValueChange={setSelectedDriverId}
                disabled={!relatedJob || relatedJob.status !== 'routed'}
              >
                <SelectTrigger id="newDriver">
                  <SelectValue placeholder="Select a driver or unassign..." />
                </SelectTrigger>
                <SelectContent position="popper" side="bottom" sideOffset={5}>
                  <SelectItem value="unassign">
                    <div className="flex items-center gap-2 text-destructive">
                      <span>Unassign Driver</span>
                    </div>
                  </SelectItem>
                  {(() => {
                    // Get current driver and vehicle info
                    const currentDriverId = relatedJob?.driver?.id;
                    const currentVehicleReg = relatedJob?.driver?.vehicleReg;
                    
                    // Create separate entries for each driver-vehicle combination
                    // Exclude the current driver-vehicle combination
                    const driverVehicleCombinations: Array<{
                      driverId: string;
                      driverName: string;
                      vehicle: { id: string; vehicleReg: string; vehicleType: string; vehicleFuelType: string };
                    }> = [];
                    
                    driversWithVehicles.forEach((driver) => {
                      const driverVehicles = driver.vehicles && driver.vehicles.length > 0 
                        ? driver.vehicles 
                        : driver.vehicleReg 
                          ? [{ id: driver.vehicleId || '', vehicleReg: driver.vehicleReg, vehicleType: driver.vehicleType || 'van', vehicleFuelType: driver.vehicleFuelType || 'diesel' }]
                          : [];
                      
                      driverVehicles.forEach((vehicle) => {
                        // Exclude current driver-vehicle combination
                        const isCurrent = currentDriverId === driver.id && currentVehicleReg === vehicle.vehicleReg;
                        if (!isCurrent) {
                          driverVehicleCombinations.push({
                            driverId: driver.id,
                            driverName: driver.name,
                            vehicle,
                          });
                        }
                      });
                    });
                    
                    return driverVehicleCombinations.map((combo) => {
                      // Use vehicle.id if available, otherwise use a fallback
                      const vehicleId = combo.vehicle.id || combo.driverId;
                      const value = `${combo.driverId}:${vehicleId}`;
                      return (
                        <SelectItem key={value} value={value}>
                          <div className="flex flex-col gap-1">
                            <span>{combo.driverName}</span>
                            <div className="text-xs text-muted-foreground">
                              {combo.vehicle.vehicleReg} - {combo.vehicle.vehicleType} {combo.vehicle.vehicleFuelType}
                            </div>
                          </div>
                        </SelectItem>
                      );
                    });
                  })()}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReassignBookingId(null);
                setSelectedDriverId("");
              }}
              disabled={reassignDriver.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!relatedJob) {
                  toast.error("Job not found");
                  return;
                }

                if (relatedJob.status !== 'routed') {
                  toast.error("Can only re-assign/unassign driver when job status is 'routed'");
                  return;
                }

                if (selectedDriverId === 'unassign') {
                  // Unassign driver
                  reassignDriver.mutate(
                    { jobId: relatedJob.id, driverId: null },
                    {
                      onSuccess: () => {
                        toast.success("Driver unassigned successfully");
                        setReassignBookingId(null);
                        setSelectedDriverId("");
                      },
                      onError: (error) => {
                        toast.error("Failed to unassign driver", {
                          description: error instanceof Error ? error.message : "Please try again.",
                        });
                      },
                    }
                  );
                } else if (selectedDriverId) {
                  // Re-assign to new driver-vehicle combination
                  // Parse driverId:vehicleId format
                  const [driverId, vehicleId] = selectedDriverId.split(':');
                  reassignDriver.mutate(
                    { jobId: relatedJob.id, driverId, vehicleId },
                    {
                      onSuccess: () => {
                        toast.success("Driver re-assigned successfully");
                        setReassignBookingId(null);
                        setSelectedDriverId("");
                      },
                      onError: (error) => {
                        toast.error("Failed to re-assign driver", {
                          description: error instanceof Error ? error.message : "Please try again.",
                        });
                      },
                    }
                  );
                } else {
                  toast.error("Please select a driver or choose to unassign");
                }
              }}
              disabled={
                !selectedDriverId || 
                reassignDriver.isPending || 
                !relatedJob || 
                relatedJob.status !== 'routed' ||
                (selectedDriverId !== 'unassign' && selectedDriverId === getCurrentDriverVehicleSelection())
              }
            >
              {reassignDriver.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {selectedDriverId === 'unassign' ? 'Unassigning...' : 'Re-assigning...'}
                </>
              ) : (
                selectedDriverId === 'unassign' ? 'Unassign Driver' : 'Re-assign Driver'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Schedule Date Dialog */}
      <Dialog open={!!editDateBookingId} onOpenChange={(open) => !open && closeEditDateDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Scheduled Date</DialogTitle>
            <DialogDescription>
              Update the scheduled date for this booking. The client will receive a schedule change email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="scheduled-date">New scheduled date</Label>
            <Input
              id="scheduled-date"
              type="date"
              value={newScheduledDate}
              onChange={(e) => setNewScheduledDate(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEditDateDialog} disabled={updateScheduledDate.isPending}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!editDateBookingId || !newScheduledDate) return;

                updateScheduledDate.mutate(
                  { bookingId: editDateBookingId, scheduledDate: new Date(`${newScheduledDate}T00:00:00.000Z`).toISOString() },
                  {
                    onSuccess: () => {
                      toast.success("Scheduled date updated", {
                        description: "The client has been notified by email.",
                      });
                      closeEditDateDialog();
                    },
                    onError: (error) => {
                      toast.error("Failed to update scheduled date", {
                        description: error instanceof Error ? error.message : "Please try again.",
                      });
                    },
                  }
                );
              }}
              disabled={updateScheduledDate.isPending || !newScheduledDate}
            >
              {updateScheduledDate.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Date'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BookingQueue;

