import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Search, Calendar, MapPin, Package, ArrowRight, Loader2, Truck, User, Mail, Phone, Laptop, Wrench } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { useBookings } from "@/hooks/useBookings";
import { useAvailableInventory } from "@/hooks/useInventory";
import { jmlBookingService } from "@/services/jml-booking.service";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";

const JMLBookings = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [subTypeFilter, setSubTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [actionType, setActionType] = useState<'allocate' | 'tracking' | 'delivered' | 'collected' | null>(null);
  const [serialNumber, setSerialNumber] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [collectionItems, setCollectionItems] = useState<Array<{
    make: string;
    model: string;
    serialNumber: string;
    imei?: string;
    accessories?: string[];
  }>>([{ make: "", model: "", serialNumber: "" }]);
  const queryClient = useQueryClient();

  const { data: bookings = [], isLoading } = useBookings();
  
  // Filter JML bookings only
  const jmlBookings = useMemo(() => {
    return bookings.filter(b => b.bookingType === 'jml');
  }, [bookings]);

  // Get available inventory for allocation (unallocated inventory)
  const { data: availableInventory = [] } = useAvailableInventory(
    '', // Empty string means null (unallocated)
    selectedBooking?.deviceType ? (selectedBooking.deviceType.includes('laptop') ? 'laptop' : selectedBooking.deviceType.includes('mobile') ? 'mobile' : undefined) : undefined
  );

  const allocateDeviceMutation = useMutation({
    mutationFn: ({ bookingId, serialNumber }: { bookingId: string; serialNumber: string }) =>
      jmlBookingService.allocateDevice(bookingId, serialNumber),
    onSuccess: () => {
      toast.success("Device allocated successfully");
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setActionType(null);
      setSelectedBooking(null);
      setSerialNumber("");
    },
    onError: (error) => {
      toast.error("Failed to allocate device", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    },
  });

  const updateTrackingMutation = useMutation({
    mutationFn: ({ bookingId, trackingNumber }: { bookingId: string; trackingNumber: string }) =>
      jmlBookingService.updateCourierTracking(bookingId, trackingNumber),
    onSuccess: () => {
      toast.success("Tracking number updated");
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setActionType(null);
      setSelectedBooking(null);
      setTrackingNumber("");
    },
    onError: (error) => {
      toast.error("Failed to update tracking", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    },
  });

  const markDeliveredMutation = useMutation({
    mutationFn: (bookingId: string) => jmlBookingService.markDelivered(bookingId),
    onSuccess: () => {
      toast.success("Booking marked as delivered");
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setActionType(null);
      setSelectedBooking(null);
    },
    onError: (error) => {
      toast.error("Failed to mark as delivered", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    },
  });

  const markCollectedMutation = useMutation({
    mutationFn: ({ bookingId, items }: { bookingId: string; items: any[] }) =>
      jmlBookingService.markCollected(bookingId, items),
    onSuccess: () => {
      toast.success("Booking marked as collected");
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setActionType(null);
      setSelectedBooking(null);
      setCollectionItems([{ make: "", model: "", serialNumber: "" }]);
    },
    onError: (error) => {
      toast.error("Failed to mark as collected", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    },
  });

  const filteredBookings = useMemo(() => {
    return jmlBookings.filter((booking) => {
      const matchesSearch =
        booking.employeeName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        booking.bookingNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        booking.siteName.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesSubType = subTypeFilter === "all" || booking.jmlSubType === subTypeFilter;
      const matchesStatus = statusFilter === "all" || booking.status === statusFilter;

      return matchesSearch && matchesSubType && matchesStatus;
    });
  }, [jmlBookings, searchQuery, subTypeFilter, statusFilter]);

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-500/10 text-yellow-500",
    device_allocated: "bg-blue-500/10 text-blue-500",
    courier_booked: "bg-purple-500/10 text-purple-500",
    delivered: "bg-green-500/10 text-green-500",
    collection_scheduled: "bg-cyan-500/10 text-cyan-500",
    collected: "bg-teal-500/10 text-teal-500",
    warehouse: "bg-gray-500/10 text-gray-500",
    sanitised: "bg-indigo-500/10 text-indigo-500",
    graded: "bg-pink-500/10 text-pink-500",
    completed: "bg-green-500/10 text-green-500",
  };

  const subTypeLabels: Record<string, string> = {
    new_starter: "New Starter",
    leaver: "Leaver",
    breakfix: "Breakfix",
    mover: "Mover",
  };

  const subTypeIcons: Record<string, any> = {
    new_starter: User,
    leaver: User,
    breakfix: Wrench,
    mover: User,
  };

  const handleAllocateDevice = () => {
    if (!selectedBooking || !serialNumber) {
      toast.error("Please select a serial number");
      return;
    }
    allocateDeviceMutation.mutate({
      bookingId: selectedBooking.id,
      serialNumber,
    });
  };

  const handleUpdateTracking = () => {
    if (!selectedBooking || !trackingNumber) {
      toast.error("Please enter a tracking number");
      return;
    }
    updateTrackingMutation.mutate({
      bookingId: selectedBooking.id,
      trackingNumber,
    });
  };

  const handleMarkDelivered = () => {
    if (!selectedBooking) return;
    markDeliveredMutation.mutate(selectedBooking.id);
  };

  const handleMarkCollected = () => {
    if (!selectedBooking) return;
    const validItems = collectionItems.filter(item => item.make && item.model && item.serialNumber);
    if (validItems.length === 0) {
      toast.error("Please add at least one collected item");
      return;
    }
    markCollectedMutation.mutate({
      bookingId: selectedBooking.id,
      items: validItems,
    });
  };

  const addCollectionItem = () => {
    setCollectionItems([...collectionItems, { make: "", model: "", serialNumber: "" }]);
  };

  const removeCollectionItem = (index: number) => {
    setCollectionItems(collectionItems.filter((_, i) => i !== index));
  };

  const updateCollectionItem = (index: number, field: string, value: string) => {
    const updated = [...collectionItems];
    updated[index] = { ...updated[index], [field]: value };
    setCollectionItems(updated);
  };

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">JML Bookings</h1>
          <p className="text-muted-foreground">
            Manage Joiners, Leavers, Movers bookings
          </p>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by employee name, booking number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
        <Select value={subTypeFilter} onValueChange={setSubTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Sub-type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="new_starter">New Starter</SelectItem>
            <SelectItem value="leaver">Leaver</SelectItem>
            <SelectItem value="breakfix">Breakfix</SelectItem>
            <SelectItem value="mover">Mover</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="device_allocated">Device Allocated</SelectItem>
            <SelectItem value="courier_booked">Courier Booked</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="collection_scheduled">Collection Scheduled</SelectItem>
            <SelectItem value="collected">Collected</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4">
        {filteredBookings.map((booking) => {
          const SubTypeIcon = subTypeIcons[booking.jmlSubType || ''] || User;
          return (
            <Card key={booking.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <SubTypeIcon className="h-5 w-5 text-muted-foreground" />
                      <h3 className="font-semibold text-lg">{booking.employeeName || 'N/A'}</h3>
                      <Badge className={statusColors[booking.status] || ''}>
                        {booking.status.replace('_', ' ')}
                      </Badge>
                      <Badge variant="outline">
                        {subTypeLabels[booking.jmlSubType || ''] || booking.jmlSubType}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        <span>{booking.bookingNumber}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>{format(new Date(booking.scheduledDate), 'MMM dd, yyyy')}</span>
                      </div>
                      {booking.jmlSubType === 'mover' && booking.currentAddress ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs">
                            <MapPin className="h-3.5 w-3.5" />
                            <span>From: {booking.currentSiteName || 'Current'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <MapPin className="h-3.5 w-3.5 text-primary" />
                            <span>To: {booking.siteName}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          <span>{booking.siteName}</span>
                        </div>
                      )}
                      {booking.deviceType && (
                        <div className="flex items-center gap-2">
                          <Laptop className="h-4 w-4" />
                          <span>{booking.deviceType}</span>
                        </div>
                      )}
                    </div>
                    {booking.courierTracking && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Tracking: </span>
                        <span className="font-mono">{booking.courierTracking}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {booking.status === 'pending' && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedBooking(booking);
                          setActionType('allocate');
                        }}
                      >
                        Allocate Device
                      </Button>
                    )}
                    {booking.status === 'device_allocated' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedBooking(booking);
                          setActionType('tracking');
                        }}
                      >
                        Add Tracking
                      </Button>
                    )}
                    {booking.status === 'courier_booked' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedBooking(booking);
                          setActionType('delivered');
                        }}
                      >
                        Mark Delivered
                      </Button>
                    )}
                    {(booking.status === 'pending' || booking.status === 'collection_scheduled') && booking.jmlSubType === 'leaver' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedBooking(booking);
                          setActionType('collected');
                        }}
                      >
                        Mark Collected
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" asChild>
                      <Link to={`/bookings/${booking.id}`}>
                        View Details
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredBookings.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">No JML bookings found</p>
          </CardContent>
        </Card>
      )}

      {/* Allocate Device Dialog */}
      <Dialog open={actionType === 'allocate' && !!selectedBooking} onOpenChange={(open) => !open && setActionType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Allocate Device</DialogTitle>
            <DialogDescription>
              Select a device from available inventory for {selectedBooking?.employeeName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Available Inventory</Label>
              <Select value={serialNumber} onValueChange={setSerialNumber}>
                <SelectTrigger>
                  <SelectValue placeholder="Select serial number" />
                </SelectTrigger>
                <SelectContent>
                  {availableInventory.map((item) => (
                    <SelectItem key={item.id} value={item.serialNumber}>
                      {item.make} {item.model} - {item.serialNumber} ({item.conditionCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionType(null)}>Cancel</Button>
            <Button onClick={handleAllocateDevice} disabled={allocateDeviceMutation.isPending}>
              {allocateDeviceMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Allocating...
                </>
              ) : (
                'Allocate'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Tracking Dialog */}
      <Dialog open={actionType === 'tracking' && !!selectedBooking} onOpenChange={(open) => !open && setActionType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Courier Tracking</DialogTitle>
            <DialogDescription>
              Enter the courier tracking number for {selectedBooking?.employeeName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tracking Number</Label>
              <Input
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="ABC123456789"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionType(null)}>Cancel</Button>
            <Button onClick={handleUpdateTracking} disabled={updateTrackingMutation.isPending}>
              {updateTrackingMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark Delivered Dialog */}
      <Dialog open={actionType === 'delivered' && !!selectedBooking} onOpenChange={(open) => !open && setActionType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Delivered</DialogTitle>
            <DialogDescription>
              Confirm that the device has been delivered to {selectedBooking?.employeeName}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionType(null)}>Cancel</Button>
            <Button onClick={handleMarkDelivered} disabled={markDeliveredMutation.isPending}>
              {markDeliveredMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Mark Delivered'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark Collected Dialog */}
      <Dialog open={actionType === 'collected' && !!selectedBooking} onOpenChange={(open) => !open && setActionType(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Mark as Collected</DialogTitle>
            <DialogDescription>
              Log the items collected from {selectedBooking?.employeeName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {collectionItems.map((item, index) => (
              <Card key={index}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Item {index + 1}</Label>
                    {collectionItems.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeCollectionItem(index)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Make *</Label>
                      <Input
                        value={item.make}
                        onChange={(e) => updateCollectionItem(index, 'make', e.target.value)}
                        placeholder="Dell, HP, Apple"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Model *</Label>
                      <Input
                        value={item.model}
                        onChange={(e) => updateCollectionItem(index, 'model', e.target.value)}
                        placeholder="Latitude 7420"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Serial Number *</Label>
                      <Input
                        value={item.serialNumber}
                        onChange={(e) => updateCollectionItem(index, 'serialNumber', e.target.value)}
                        placeholder="ABC123XYZ"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>IMEI (if mobile)</Label>
                      <Input
                        value={item.imei || ''}
                        onChange={(e) => updateCollectionItem(index, 'imei', e.target.value)}
                        placeholder="123456789012345"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Accessories (comma-separated)</Label>
                    <Input
                      value={item.accessories?.join(', ') || ''}
                      onChange={(e) => updateCollectionItem(index, 'accessories', e.target.value.split(',').map(a => a.trim()))}
                      placeholder="PSU, Charger, Case"
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
            <Button variant="outline" onClick={addCollectionItem} className="w-full">
              Add Another Item
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionType(null)}>Cancel</Button>
            <Button onClick={handleMarkCollected} disabled={markCollectedMutation.isPending}>
              {markCollectedMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Mark Collected'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default JMLBookings;
