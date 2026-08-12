import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, UserPlus, Truck, Calendar, MapPin, Package, Loader2, CheckCircle2, Car, AlertTriangle, Route, Fuel, PackageSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBooking, useAssignDriver, useBookCourier } from "@/hooks/useBookings";
import { useDrivers } from "@/hooks/useDrivers";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import type { BookingLifecycleStatus } from "@/types/booking-lifecycle";
import { calculateRoundTripDistance, geocodePostcode, kmToMiles } from "@/lib/calculations";
import { log } from '@/lib/log';
import { UK_TIME_ZONE } from '@/lib/datetime';

const FREE_COURIER_MAX_ITEMS = 5;

const isFreeCourierBooking = (booking?: {
  bookingType?: 'itad_collection' | 'free_collection' | 'jml' | null;
  assets?: Array<{ categoryName?: string; quantity: number }>;
} | null) => {
  if (!booking) return false;
  if (booking.bookingType === 'free_collection') return true;
  if (booking.bookingType && booking.bookingType !== 'itad_collection') return false;

  const assets = booking.assets || [];
  if (assets.length === 0) return false;

  const totalUnits = assets.reduce((sum, asset) => sum + (asset.quantity || 0), 0);
  if (totalUnits <= 0 || totalUnits > FREE_COURIER_MAX_ITEMS) return false;

  return assets.every((asset) => {
    const categoryName = (asset.categoryName || "").toLowerCase();
    return categoryName.includes("phone") || categoryName.includes("laptop");
  });
};

const Assignment = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get("booking");

  const { data: booking, isLoading: isLoadingBooking } = useBooking(bookingId);
  const { data: drivers = [], isLoading: isLoadingDrivers } = useDrivers();
  const [selectedDriverVehicle, setSelectedDriverVehicle] = useState<{ driverId: string; vehicleId: string } | null>(null);
  const [roundTripDistanceKm, setRoundTripDistanceKm] = useState<number | null>(null);
  const [isCalculatingDistance, setIsCalculatingDistance] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [courierService, setCourierService] = useState<string>("");
  const [otherCourierService, setOtherCourierService] = useState<string>("");
  const assignMutation = useAssignDriver();
  const bookCourierMutation = useBookCourier();
  
  const isJMLBooking = booking?.bookingType === 'jml';
  const isFreeCollectionBooking = isFreeCourierBooking(booking);
  const useCourierFlow = isJMLBooking || isFreeCollectionBooking;
  
  // Filter out drivers without allocated vehicles
  const driversWithVehicles = drivers.filter(driver => driver.hasVehicle && (driver.vehicleReg || (driver.vehicles && driver.vehicles.length > 0)));
  
  const assignedDriver = booking?.driverId ? driversWithVehicles.find(d => d.id === booking.driverId) || drivers.find(d => d.id === booking.driverId) : null;
  const assignedDriverVehicles = assignedDriver?.vehicles && assignedDriver.vehicles.length > 0
    ? assignedDriver.vehicles
    : assignedDriver?.vehicleReg
      ? [{ id: assignedDriver.vehicleId || '', vehicleReg: assignedDriver.vehicleReg, vehicleType: assignedDriver.vehicleType || 'van', vehicleFuelType: assignedDriver.vehicleFuelType || 'diesel' }]
      : [];

  // Set selected driver-vehicle if booking already has one
  useEffect(() => {
    if (booking?.driverId) {
      const driver = drivers.find(d => d.id === booking.driverId);
      if (driver) {
        const firstVehicle = driver.vehicles && driver.vehicles.length > 0 
          ? driver.vehicles[0] 
          : driver.vehicleId 
            ? { id: driver.vehicleId, vehicleReg: driver.vehicleReg || '', vehicleType: driver.vehicleType || 'van', vehicleFuelType: driver.vehicleFuelType || 'diesel' }
            : null;
        if (firstVehicle) {
          setSelectedDriverVehicle({ driverId: booking.driverId, vehicleId: firstVehicle.id });
        }
      }
    } else {
      // Clear stale selection after driver unassignment.
      setSelectedDriverVehicle(null);
    }
  }, [booking, drivers]);

  // Use stored round trip distance from booking, or calculate if not available
  useEffect(() => {
    const calculateDistance = async () => {
      // First, check if booking already has stored distance (preferred)
      if (booking?.roundTripDistanceKm && booking.roundTripDistanceKm > 0) {
        setRoundTripDistanceKm(booking.roundTripDistanceKm);
        setIsCalculatingDistance(false);
        return;
      }
      
      // If no stored distance, try to calculate from coordinates
      if (booking?.lat && booking?.lng) {
        setIsCalculatingDistance(true);
        try {
          const distanceKm = await calculateRoundTripDistance(booking.lat, booking.lng);
          setRoundTripDistanceKm(distanceKm);
        } catch (error) {
          log.error('Error calculating road distance from coordinates:', error);
          // Fallback: try postcode geocoding
          if (booking.siteAddress) {
            try {
              const postcodeMatch = booking.siteAddress.match(/\b[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}\b/i);
              if (postcodeMatch) {
                const postcode = postcodeMatch[0].replace(/\s+/g, ' ').trim().toUpperCase();
                const coordinates = await geocodePostcode(postcode);
                if (coordinates) {
                  const distanceKm = await calculateRoundTripDistance(coordinates.lat, coordinates.lng);
                  setRoundTripDistanceKm(distanceKm);
                  return;
                }
              }
            } catch (geocodeError) {
              log.error('Error geocoding postcode:', geocodeError);
            }
          }
          // Final fallback: set to 0 to indicate calculation failed
          setRoundTripDistanceKm(0); // Set to 0 to show error/warning in UI
        } finally {
          setIsCalculatingDistance(false);
        }
        return;
      }
      
      // If no coordinates, try to geocode from postcode in address
      if (booking?.siteAddress) {
        setIsCalculatingDistance(true);
        try {
          // Extract postcode from address (UK postcode format: e.g., "SW1A 1AA", "M1 1AA", "B33 8TH")
          // Pattern matches: 1-2 letters, 1-2 digits, optional letter, space, digit, 2 letters
          const postcodeMatch = booking.siteAddress.match(/\b[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}\b/i);
          if (postcodeMatch) {
            const postcode = postcodeMatch[0].replace(/\s+/g, ' ').trim().toUpperCase();
            const coordinates = await geocodePostcode(postcode);
            if (coordinates) {
              const distanceKm = await calculateRoundTripDistance(coordinates.lat, coordinates.lng);
              setRoundTripDistanceKm(distanceKm);
              setIsCalculatingDistance(false);
              return;
            }
          }
          // No postcode found or geocoding failed, set to 0
          setRoundTripDistanceKm(0); // Set to 0 to show error/warning in UI
        } catch (error) {
          log.error('Failed to calculate distance:', error);
          setRoundTripDistanceKm(0); // Set to 0 to show error/warning in UI
        } finally {
          setIsCalculatingDistance(false);
        }
        return;
      }
      
      // No booking data available, set to 0
      setRoundTripDistanceKm(0); // Set to 0 to show error/warning in UI
      setIsCalculatingDistance(false);
    };

    if (booking) {
      calculateDistance();
    }
  }, [booking]);

  const handleAssign = () => {
    if (!bookingId || !selectedDriverVehicle) {
      toast.error("Please select a driver and vehicle");
      return;
    }

    if (booking?.status !== 'created') {
      toast.error("Only bookings in 'created' status can be assigned");
      return;
    }

    assignMutation.mutate(
      { bookingId, driverId: selectedDriverVehicle.driverId, vehicleId: selectedDriverVehicle.vehicleId },
      {
        onSuccess: () => {
          toast.success("Driver and vehicle assigned successfully!", {
            description: "Booking has been scheduled and driver has been notified.",
          });
          navigate("/admin/bookings");
        },
        onError: (error) => {
          toast.error("Failed to assign driver", {
            description: error instanceof Error ? error.message : "Please try again.",
          });
        },
      }
    );
  };

  const handleBookCourier = () => {
    if (!bookingId || !trackingNumber.trim()) {
      toast.error("Please enter a tracking number");
      return;
    }

    if (!courierService) {
      toast.error("Please select a courier service");
      return;
    }

    if (courierService === 'other' && !otherCourierService.trim()) {
      toast.error("Please enter the courier service name");
      return;
    }

    // For new_starter and breakfix, device must be allocated first
    if ((booking?.jmlSubType === 'new_starter' || booking?.jmlSubType === 'breakfix') && 
        booking?.status !== 'device_allocated') {
      toast.error("Device must be allocated before booking courier for this booking type");
      return;
    }

    // Free collection: allow courier booking from created and collection_scheduled.
    if (isFreeCollectionBooking) {
      if (booking?.status !== 'created' && booking?.status !== 'collection_scheduled') {
        toast.error("Only free-collection bookings in 'created' or 'collection_scheduled' status can have courier booked");
        return;
      }
    } else {
      // For other JML types (leaver, mover), allow from created status
      if (booking?.status !== 'device_allocated' && booking?.status !== 'created' && booking?.status !== 'courier_booked') {
        toast.error("Only bookings in 'device_allocated', 'created', or 'courier_booked' status can have courier booked");
        return;
      }
    }

    const finalCourierService = courierService === 'other' ? otherCourierService.trim() : courierService;

    bookCourierMutation.mutate(
      { bookingId, trackingNumber: trackingNumber.trim(), courierService: finalCourierService },
      {
        onSuccess: () => {
          toast.success("Courier booked successfully!", {
            description: isFreeCollectionBooking
              ? "Tracking number has been added and booking status updated to 'collection_scheduled'."
              : "Tracking number has been added and booking status updated to 'courier_booked'.",
          });
          navigate("/admin/bookings");
        },
        onError: (error) => {
          toast.error("Failed to book courier", {
            description: error instanceof Error ? error.message : "Please try again.",
          });
        },
      }
    );
  };

  // Initialize tracking number and courier service from booking if available
  useEffect(() => {
    if (!booking) return;

    // Mover at device_allocated: form is for a new delivery courier — do not pre-fill with collection tracking
    if (booking.bookingType === 'jml' && booking.jmlSubType === 'mover' && booking.status === 'device_allocated') {
      setTrackingNumber('');
      return;
    }

    if (booking.courierTracking) {
      setTrackingNumber(booking.courierTracking);
    }
    if (booking.courierService) {
      const predefinedServices = ['fedex', 'dpd', 'ups', 'parcelforce', 'royalmail'];
      const serviceLower = booking.courierService.toLowerCase();
      if (predefinedServices.includes(serviceLower)) {
        setCourierService(serviceLower);
      } else {
        setCourierService('other');
        setOtherCourierService(booking.courierService);
      }
    }
  }, [booking]);

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
        <Button onClick={() => navigate("/admin/bookings")}>Back to Booking Queue</Button>
      </div>
    );
  }

  if (useCourierFlow) {
    // For JML bookings, check if status allows courier booking
    const isAllowedFreeStatus = booking.status === 'created' || booking.status === 'collection_scheduled';
    const isAllowedJmlStatus = booking.status === 'device_allocated' || booking.status === 'created' || booking.status === 'courier_booked';
    if ((isJMLBooking && !isAllowedJmlStatus) || (isFreeCollectionBooking && !isAllowedFreeStatus)) {
      return (
        <div className="space-y-6">
          <Alert>
            <AlertDescription>
              This booking cannot have courier booked. Only eligible statuses can have courier booked.
              Current status: {booking.status}
            </AlertDescription>
          </Alert>
          <Button onClick={() => navigate("/admin/bookings")}>Back to Booking Queue</Button>
        </div>
      );
    }
  } else {
    // For ITAD bookings, check if status allows driver assignment
    if (booking.status !== 'created' && booking.status !== 'scheduled') {
      return (
        <div className="space-y-6">
          <Alert>
            <AlertDescription>
              This booking cannot be assigned. Only bookings in "created" status can be assigned a driver.
              Current status: {booking.status}
            </AlertDescription>
          </Alert>
          <Button onClick={() => navigate("/admin/bookings")}>Back to Booking Queue</Button>
        </div>
      );
    }
  }

  const totalAssets = booking.assets.reduce((sum, a) => sum + a.quantity, 0);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
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
          <h2 className="text-2xl font-bold text-foreground">
            {useCourierFlow ? "Book Courier" : "Assign Driver"}
          </h2>
          <p className="text-muted-foreground">
            {useCourierFlow
              ? booking.jmlSubType === 'mover' && booking.status === 'device_allocated'
                ? "Collection tracking is kept below. Book a new courier for delivery of devices to the new address."
                : "Add courier tracking for collection or delivery"
              : "Schedule booking and assign driver for collection"}
          </p>
        </div>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Booking Details */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Booking Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Booking Number</p>
                <p className="font-mono">{booking.bookingNumber}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Organisation</p>
                <p className="font-semibold">{booking.organisationName || booking.clientName}</p>
              </div>
              {booking.createdByName && (
                <div>
                  <p className="text-sm text-muted-foreground">Booked by</p>
                  <p>{booking.createdByName}</p>
                </div>
              )}
              {booking.jmlSubType === 'mover' && (booking.currentAddress || booking.currentSiteName) ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">From</p>
                      <p className="font-medium">{booking.currentSiteName || 'Current address'}</p>
                      <p className="text-sm text-muted-foreground">{booking.currentAddress}</p>
                      {booking.currentPostcode && (
                        <p className="text-xs text-muted-foreground">{booking.currentPostcode}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-primary mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">To</p>
                      <p className="font-medium">{booking.siteName}</p>
                      <p className="text-sm text-muted-foreground">{booking.siteAddress}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Site</p>
                    <p>{booking.siteName}</p>
                    <p className="text-sm text-muted-foreground">{booking.siteAddress}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Scheduled Date</p>
                  <p>{new Date(booking.scheduledDate).toLocaleDateString("en-GB", { timeZone: UK_TIME_ZONE,
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Assets</p>
                  <p>{totalAssets} items</p>
                  <div className="text-sm text-muted-foreground mt-1">
                    {booking.assets.map(a => `${a.quantity}x ${a.categoryName}`).join(", ")}
                  </div>
                </div>
              </div>
              {roundTripDistanceKm !== null && (
                <div className="flex items-center gap-2 pt-2 border-t">
                  <Route className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Round Trip Mileage</p>
                    {isCalculatingDistance ? (
                      <p className="text-sm text-muted-foreground">Calculating...</p>
                    ) : roundTripDistanceKm > 0 ? (
                      <p className="font-semibold">
                        {kmToMiles(roundTripDistanceKm).toFixed(1)} miles ({roundTripDistanceKm.toFixed(1)} km)
                      </p>
                    ) : (
                      <>
                        <p className="font-semibold text-warning">0 km</p>
                        <p className="text-xs text-warning mt-0.5">
                          ⚠️ Distance calculation failed. Please check location or set distance manually.
                        </p>
                      </>
                    )}
                    {roundTripDistanceKm > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        From collection site to warehouse and return
                      </p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Assignment Form */}
        <div className="space-y-6">
          {useCourierFlow ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PackageSearch className="h-5 w-5" />
                  {booking.jmlSubType === 'mover' && booking.status === 'device_allocated'
                    ? 'Delivery courier (new devices)'
                    : 'Courier booking'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Mover: collection leg stays on file when booking delivery courier */}
                {booking.jmlSubType === 'mover' &&
                  ((booking as { collectionCourierTracking?: string }).collectionCourierTracking ||
                    (booking as { collectionCourierService?: string }).collectionCourierService) && (
                  <div className="space-y-2 p-3 rounded-lg border bg-muted/40">
                    <p className="text-sm font-semibold text-foreground">Collection courier (reference)</p>
                    <p className="text-xs text-muted-foreground">
                      Shown for traceability. It is not changed when you book delivery below.
                    </p>
                    {(booking as { collectionCourierService?: string }).collectionCourierService && (
                      <p className="text-sm">
                        <span className="text-muted-foreground">Service: </span>
                        {(booking as { collectionCourierService?: string }).collectionCourierService}
                      </p>
                    )}
                    {(booking as { collectionCourierTracking?: string }).collectionCourierTracking && (
                      <div className="flex items-center gap-2">
                        <PackageSearch className="h-4 w-4 shrink-0" />
                        <span className="font-mono text-sm font-medium break-all">
                          {(booking as { collectionCourierTracking?: string }).collectionCourierTracking}
                        </span>
                      </div>
                    )}
                  </div>
                )}
                {booking.courierTracking &&
                  !(booking.jmlSubType === 'mover' && booking.status === 'device_allocated') && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">Current tracking number</p>
                    <div className="p-3 rounded-lg bg-muted space-y-2">
                      <div className="flex items-center gap-2">
                        <PackageSearch className="h-4 w-4" />
                        <span className="font-mono font-medium">{booking.courierTracking}</span>
                      </div>
                    </div>
                  </div>
                )}
                {booking.jmlSubType === 'mover' &&
                  booking.status === 'courier_booked' &&
                  booking.courierTracking && (
                  <div className="space-y-2 p-3 rounded-lg bg-muted/30 border">
                    <p className="text-sm font-medium text-muted-foreground">Delivery tracking (current)</p>
                    <div className="flex items-center gap-2">
                      <PackageSearch className="h-4 w-4 shrink-0" />
                      <span className="font-mono text-sm font-medium break-all">{booking.courierTracking}</span>
                    </div>
                    {booking.courierService && (
                      <p className="text-xs text-muted-foreground">Service: {booking.courierService}</p>
                    )}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="courier-service">Courier Service *</Label>
                  <Select value={courierService} onValueChange={setCourierService}>
                    <SelectTrigger id="courier-service">
                      <SelectValue placeholder="Select courier service..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fedex">FedEx</SelectItem>
                      <SelectItem value="dpd">DPD</SelectItem>
                      <SelectItem value="ups">UPS</SelectItem>
                      <SelectItem value="parcelforce">Parcelforce</SelectItem>
                      <SelectItem value="royalmail">Royal Mail</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  {courierService === 'other' && (
                    <div className="space-y-2 mt-2">
                      <Label htmlFor="other-courier-service">Courier Service Name *</Label>
                      <Input
                        id="other-courier-service"
                        placeholder="Enter courier service name..."
                        value={otherCourierService}
                        onChange={(e) => setOtherCourierService(e.target.value)}
                      />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tracking-number">Tracking Number *</Label>
                  <Input
                    id="tracking-number"
                    placeholder="Enter tracking number..."
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    {booking.jmlSubType === 'mover' && booking.status === 'device_allocated'
                      ? "Enter the delivery courier’s tracking number for the new devices."
                      : booking.courierTracking
                        ? "Update the tracking number if it has changed."
                        : "Enter the tracking number provided by the courier service."}
                  </p>
                </div>
                <Button
                  variant="default"
                  onClick={handleBookCourier}
                  disabled={
                    !trackingNumber.trim() || 
                    !courierService || 
                    (courierService === 'other' && !otherCourierService.trim()) ||
                    bookCourierMutation.isPending
                  }
                  className="w-full"
                >
                  {bookCourierMutation.isPending ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Booking Courier...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 />
                      Book Courier
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground">
                  {booking.jmlSubType === 'mover' && booking.status === 'device_allocated'
                    ? 'Saves delivery tracking and moves the booking to courier booked. Collection tracking above is preserved.'
                    : 'This will update the booking status to "courier_booked" and add the tracking number.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Driver Assignment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
              {booking.status === 'scheduled' && booking.driverName ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Currently Assigned</p>
                  <div className="p-3 rounded-lg bg-muted space-y-2">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4" />
                      <span className="font-medium">{booking.driverName}</span>
                    </div>
                    {assignedDriverVehicles.length > 0 && (
                      <div className="pt-2 border-t border-muted-foreground/20 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          {assignedDriverVehicles.length === 1 ? 'Vehicle' : `Vehicles (${assignedDriverVehicles.length})`}
                        </p>
                        {assignedDriverVehicles.map((vehicle, idx) => (
                          <div key={vehicle.id || idx} className="flex items-center gap-2">
                            <Car className="h-4 w-4 text-muted-foreground" />
                            <div className="text-sm">
                              <p className="font-medium">{vehicle.vehicleType.charAt(0).toUpperCase() + vehicle.vehicleType.slice(1)}</p>
                              <p className="text-muted-foreground font-mono">{vehicle.vehicleReg}</p>
                              <p className="text-xs text-muted-foreground capitalize">{vehicle.vehicleFuelType}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Booking is already scheduled. To change driver, contact support.
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="driver">Select Driver</Label>
                    <Select 
                      value={selectedDriverVehicle ? `${selectedDriverVehicle.driverId}:${selectedDriverVehicle.vehicleId}` : ""} 
                      onValueChange={(value) => {
                        if (value) {
                          const [driverId, vehicleId] = value.split(':');
                          setSelectedDriverVehicle({ driverId, vehicleId });
                        } else {
                          setSelectedDriverVehicle(null);
                        }
                      }}
                    >
                      <SelectTrigger id="driver">
                        <SelectValue placeholder="Choose a driver and vehicle..." />
                      </SelectTrigger>
                      <SelectContent>
                        {isLoadingDrivers ? (
                          <SelectItem value="loading" disabled>Loading drivers...</SelectItem>
                        ) : driversWithVehicles.length === 0 ? (
                          <SelectItem value="none" disabled>No drivers with vehicles available</SelectItem>
                        ) : (() => {
                          // Create separate entries for each driver-vehicle combination
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
                              driverVehicleCombinations.push({
                                driverId: driver.id,
                                driverName: driver.name,
                                vehicle,
                              });
                            });
                          });
                          
                          return driverVehicleCombinations.map((combo) => {
                            // Use vehicle.id if available, otherwise use a fallback
                            const vehicleId = combo.vehicle.id || combo.driverId; // Fallback to driverId if vehicle has no id
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
                    {driversWithVehicles.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        No drivers with allocated vehicles found. Please allocate vehicles to drivers first.
                      </p>
                    )}
                  </div>
                  
                  {selectedDriverVehicle && (() => {
                    const driver = driversWithVehicles.find(d => d.id === selectedDriverVehicle.driverId);
                    const vehicle = driver?.vehicles?.find(v => v.id === selectedDriverVehicle.vehicleId) 
                      || (driver?.vehicleId === selectedDriverVehicle.vehicleId && driver.vehicleReg 
                        ? { id: driver.vehicleId, vehicleReg: driver.vehicleReg, vehicleType: driver.vehicleType || 'van', vehicleFuelType: driver.vehicleFuelType || 'diesel' }
                        : null);
                    return driver && vehicle ? (
                      <div className="space-y-3">
                        <div className="p-3 rounded-lg bg-muted/50 border border-muted space-y-2">
                          <p className="text-sm font-medium">Selected Driver & Vehicle</p>
                          <div className="flex items-center gap-2">
                            <Truck className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{driver.name}</span>
                          </div>
                          <div className="flex items-center gap-2 pt-2 border-t border-muted-foreground/20">
                            <Car className="h-4 w-4 text-muted-foreground" />
                            <div className="text-sm">
                              <p className="font-medium">{vehicle.vehicleType.charAt(0).toUpperCase() + vehicle.vehicleType.slice(1)}</p>
                              <p className="text-muted-foreground font-mono">{vehicle.vehicleReg}</p>
                              <p className="text-xs text-muted-foreground capitalize">{vehicle.vehicleFuelType}</p>
                            </div>
                          </div>
                        </div>
                        
                        {/* No client fuel preference for courier assignments. */}
                      </div>
                    ) : null;
                  })()}

                  <Button
                    variant="default"
                    onClick={handleAssign}
                    disabled={!selectedDriverVehicle || assignMutation.isPending}
                    className="w-full"
                  >
                    {assignMutation.isPending ? (
                      <>
                        <Loader2 className="animate-spin" />
                        Assigning...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 />
                        Assign & Schedule
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    This will change booking status to "scheduled" and notify the driver.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Assignment;

