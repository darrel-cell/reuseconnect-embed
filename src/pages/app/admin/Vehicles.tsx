import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Truck, Plus, Trash2, Loader2, Edit2, X, CheckCircle2, AlertCircle, Icon } from "lucide-react";
import { steeringWheel } from "@lucide/lab";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useVehicles, useCreateVehicle, useUpdateVehicle, useDeleteVehicle, useAllocateVehicle, useRemoveDriverFromVehicle } from "@/hooks/useVehicles";
import { useDrivers } from "@/hooks/useDrivers";
import { toast } from "sonner";

// Steering Wheel Icon Component (from @lucide/lab)
const SteeringWheelIcon = ({ className }: { className?: string }) => {
  return <Icon iconNode={steeringWheel} className={className} />;
};

const Vehicles = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [allocationFilter, setAllocationFilter] = useState<"all" | "allocated" | "unallocated">("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAllocateDialogOpen, setIsAllocateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    vehicleReg: "",
    vehicleType: "van" as "van" | "truck" | "car",
    vehicleFuelType: "petrol" as "petrol" | "diesel" | "electric",
  });

  const { data: vehicles = [], isLoading, error } = useVehicles();
  const { data: drivers = [] } = useDrivers();
  const createVehicle = useCreateVehicle();
  const updateVehicle = useUpdateVehicle();
  const deleteVehicle = useDeleteVehicle();
  const allocateVehicle = useAllocateVehicle();
  const removeDriver = useRemoveDriverFromVehicle();

  const filteredVehicles = vehicles.filter((vehicle) => {
    const driverNames = vehicle.drivers?.map(vd => vd.driver.name).join(' ') || '';
    const matchesSearch =
      vehicle.vehicleReg.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.vehicleType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.vehicleFuelType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      driverNames.toLowerCase().includes(searchQuery.toLowerCase());
    
    const hasDrivers = vehicle.drivers && vehicle.drivers.length > 0;
    const matchesAllocation =
      allocationFilter === "all" ||
      (allocationFilter === "allocated" && hasDrivers) ||
      (allocationFilter === "unallocated" && !hasDrivers);
    
    return matchesSearch && matchesAllocation;
  });

  const handleCreateClick = () => {
    setFormData({
      vehicleReg: "",
      vehicleType: "van",
      vehicleFuelType: "petrol",
    });
    setIsCreateDialogOpen(true);
  };

  const handleCreateConfirm = () => {
    if (!formData.vehicleReg.trim()) {
      toast.error("Vehicle registration is required");
      return;
    }

    createVehicle.mutate(formData, {
      onSuccess: () => {
        toast.success("Vehicle created successfully");
        setIsCreateDialogOpen(false);
        setFormData({
          vehicleReg: "",
          vehicleType: "van",
          vehicleFuelType: "petrol",
        });
      },
      onError: (error) => {
        toast.error("Failed to create vehicle", {
          description: error instanceof Error ? error.message : "Please try again.",
        });
      },
    });
  };

  const handleEditClick = (vehicleId: string) => {
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    if (vehicle) {
      setFormData({
        vehicleReg: vehicle.vehicleReg,
        vehicleType: vehicle.vehicleType,
        vehicleFuelType: vehicle.vehicleFuelType,
      });
      setSelectedVehicle(vehicleId);
      setIsEditDialogOpen(true);
    }
  };

  const handleEditConfirm = () => {
    if (!selectedVehicle) return;
    if (!formData.vehicleReg.trim()) {
      toast.error("Vehicle registration is required");
      return;
    }

    updateVehicle.mutate(
      { id: selectedVehicle, data: formData },
      {
        onSuccess: () => {
          toast.success("Vehicle updated successfully");
          setIsEditDialogOpen(false);
          setSelectedVehicle(null);
        },
        onError: (error) => {
          toast.error("Failed to update vehicle", {
            description: error instanceof Error ? error.message : "Please try again.",
          });
        },
      }
    );
  };

  const handleAllocateClick = (vehicleId: string) => {
    setSelectedVehicle(vehicleId);
    setIsAllocateDialogOpen(true);
  };

  const handleAllocateConfirm = (driverId: string | null) => {
    if (!selectedVehicle) return;

    const vehicle = vehicles.find((v) => v.id === selectedVehicle);
    const selectedDriver = driverId ? drivers.find((d) => d.id === driverId) : null;
    const isAlreadyAssigned = vehicle?.drivers?.some(vd => vd.driverId === driverId);
    
    if (driverId && isAlreadyAssigned) {
      toast.error("Driver is already assigned to this vehicle");
      return;
    }

    allocateVehicle.mutate(
      { vehicleId: selectedVehicle, driverId },
      {
        onSuccess: () => {
          if (driverId) {
            toast.success("Driver added to vehicle successfully");
          } else {
            toast.success("All drivers removed from vehicle successfully");
          }
          setIsAllocateDialogOpen(false);
          setSelectedVehicle(null);
        },
        onError: (error) => {
          toast.error("Failed to allocate vehicle", {
            description: error instanceof Error ? error.message : "Please try again.",
          });
        },
      }
    );
  };

  const handleUnallocateClick = (vehicleId: string, driverId?: string) => {
    if (driverId) {
      // Remove specific driver from vehicle
      removeDriver.mutate(
        { vehicleId, driverId },
        {
          onSuccess: () => {
            toast.success("Driver removed from vehicle successfully");
          },
          onError: (error) => {
            toast.error("Failed to remove driver from vehicle", {
              description: error instanceof Error ? error.message : "Please try again.",
            });
          },
        }
      );
      return;
    }
    
    // Remove all drivers from vehicle
    allocateVehicle.mutate(
      { vehicleId, driverId: null },
      {
        onSuccess: () => {
          toast.success("All drivers removed from vehicle successfully");
        },
        onError: (error) => {
          toast.error("Failed to unallocate vehicle", {
            description: error instanceof Error ? error.message : "Please try again.",
          });
        },
      }
    );
  };

  const handleDeleteClick = (vehicleId: string) => {
    setSelectedVehicle(vehicleId);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!selectedVehicle) return;

    deleteVehicle.mutate(selectedVehicle, {
      onSuccess: () => {
        toast.success("Vehicle deleted successfully");
        setIsDeleteDialogOpen(false);
        setSelectedVehicle(null);
      },
      onError: (error) => {
        toast.error("Failed to delete vehicle", {
          description: error instanceof Error ? error.message : "Please try again.",
        });
      },
    });
  };

  if (error) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-destructive">
              Failed to load vehicles. Please try refreshing the page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Vehicles</h1>
          <p className="text-muted-foreground mt-1">
            Manage your vehicle fleet and allocate vehicles to drivers
          </p>
        </div>
        <Button onClick={handleCreateClick}>
          <Plus className="h-4 w-4 mr-2" />
          Add Vehicle
        </Button>
      </div>

      {/* Search and Filter */}
      <div className="space-y-4">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative"
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search vehicles by registration, type, fuel, or driver..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </motion.div>

        {/* Filter Tabs */}
        <Tabs value={allocationFilter} onValueChange={(value) => setAllocationFilter(value as "all" | "allocated" | "unallocated")}>
          <TabsList>
            <TabsTrigger value="all">All Vehicles ({vehicles.length})</TabsTrigger>
            <TabsTrigger value="allocated">
              Allocated ({vehicles.filter(v => v.drivers && v.drivers.length > 0).length})
            </TabsTrigger>
            <TabsTrigger value="unallocated">
              Unallocated ({vehicles.filter(v => !v.drivers || v.drivers.length === 0).length})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Vehicles List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredVehicles.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {searchQuery
                ? "No vehicles found matching your search."
                : "No vehicles found. Add your first vehicle to get started."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredVehicles.map((vehicle, index) => (
            <motion.div
              key={vehicle.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card
                className={cn(
                  "transition-all",
                  vehicle.drivers && vehicle.drivers.length > 0
                    ? "bg-success/5"
                    : "bg-warning/5"
                )}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg font-mono">{vehicle.vehicleReg}</CardTitle>
                      <Badge
                        variant={vehicle.drivers && vehicle.drivers.length > 0 ? "default" : "secondary"}
                        className={cn(
                          vehicle.drivers && vehicle.drivers.length > 0
                            ? "bg-success/10 text-success border-success/20"
                            : "bg-warning/10 text-warning border-warning/20"
                        )}
                      >
                        {vehicle.drivers && vehicle.drivers.length > 0 ? (
                          <>
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Allocated ({vehicle.drivers.length})
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Unallocated
                          </>
                        )}
                      </Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditClick(vehicle.id)}
                        disabled={updateVehicle.isPending}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteClick(vehicle.id)}
                        disabled={deleteVehicle.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      <span className="capitalize">{vehicle.vehicleType}</span>
                      <span className="text-muted-foreground">•</span>
                      <span className="capitalize">{vehicle.vehicleFuelType}</span>
                    </div>
                    {vehicle.drivers && vehicle.drivers.length > 0 ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <SteeringWheelIcon className="h-4 w-4 text-success" />
                          <span className="text-muted-foreground text-sm font-medium">Allocated to:</span>
                        </div>
                        <div className="pl-6 space-y-1">
                          {vehicle.drivers.map((vd) => (
                            <div key={vd.id} className="flex items-center justify-between group">
                              <span className="font-medium text-foreground text-sm">{vd.driver.name}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
                                onClick={() => handleUnallocateClick(vehicle.id, vd.driverId)}
                                disabled={removeDriver.isPending}
                                title="Remove driver from vehicle"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-warning">
                        <SteeringWheelIcon className="h-4 w-4" />
                        <span className="font-medium">Not allocated</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleAllocateClick(vehicle.id)}
                      disabled={allocateVehicle.isPending}
                    >
                      <SteeringWheelIcon className="h-3 w-3 mr-1" />
                      {vehicle.drivers && vehicle.drivers.length > 0 ? "Add Driver" : "Allocate Driver"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Vehicle Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Vehicle</DialogTitle>
            <DialogDescription>
              Enter the vehicle details to add it to your fleet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="vehicleReg">Vehicle Registration *</Label>
              <Input
                id="vehicleReg"
                value={formData.vehicleReg}
                onChange={(e) =>
                  setFormData({ ...formData, vehicleReg: e.target.value.toUpperCase() })
                }
                placeholder="ABC123"
                disabled={createVehicle.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicleType">Vehicle Type *</Label>
              <Select
                value={formData.vehicleType}
                onValueChange={(value: "van" | "truck" | "car") =>
                  setFormData({ ...formData, vehicleType: value })
                }
                disabled={createVehicle.isPending}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="van">Van</SelectItem>
                  <SelectItem value="truck">Truck</SelectItem>
                  <SelectItem value="car">Car</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicleFuelType">Fuel Type *</Label>
              <Select
                value={formData.vehicleFuelType}
                onValueChange={(value: "petrol" | "diesel" | "electric") =>
                  setFormData({ ...formData, vehicleFuelType: value })
                }
                disabled={createVehicle.isPending}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="petrol">Petrol</SelectItem>
                  <SelectItem value="diesel">Diesel</SelectItem>
                  <SelectItem value="electric">Electric</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
              disabled={createVehicle.isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateConfirm} disabled={createVehicle.isPending}>
              {createVehicle.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Vehicle Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Vehicle</DialogTitle>
            <DialogDescription>
              Update the vehicle details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-vehicleReg">Vehicle Registration *</Label>
              <Input
                id="edit-vehicleReg"
                value={formData.vehicleReg}
                onChange={(e) =>
                  setFormData({ ...formData, vehicleReg: e.target.value.toUpperCase() })
                }
                placeholder="ABC123"
                disabled={updateVehicle.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-vehicleType">Vehicle Type *</Label>
              <Select
                value={formData.vehicleType}
                onValueChange={(value: "van" | "truck" | "car") =>
                  setFormData({ ...formData, vehicleType: value })
                }
                disabled={updateVehicle.isPending}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="van">Van</SelectItem>
                  <SelectItem value="truck">Truck</SelectItem>
                  <SelectItem value="car">Car</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-vehicleFuelType">Fuel Type *</Label>
              <Select
                value={formData.vehicleFuelType}
                onValueChange={(value: "petrol" | "diesel" | "electric") =>
                  setFormData({ ...formData, vehicleFuelType: value })
                }
                disabled={updateVehicle.isPending}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="petrol">Petrol</SelectItem>
                  <SelectItem value="diesel">Diesel</SelectItem>
                  <SelectItem value="electric">Electric</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false);
                setSelectedVehicle(null);
              }}
              disabled={updateVehicle.isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleEditConfirm} disabled={updateVehicle.isPending}>
              {updateVehicle.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Allocate Vehicle Dialog */}
      <Dialog open={isAllocateDialogOpen} onOpenChange={setIsAllocateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Allocate Driver</DialogTitle>
            <DialogDescription>
              Select a driver to add to this vehicle. You can assign multiple drivers to the same vehicle. Select "Unallocated" to remove all drivers from this vehicle.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Driver</Label>
              <Select
                value=""
                onValueChange={(value) => {
                  if (value === "unallocated") {
                    handleAllocateConfirm(null);
                  } else {
                    handleAllocateConfirm(value);
                  }
                }}
                disabled={allocateVehicle.isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select driver to add" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unallocated">Remove All Drivers</SelectItem>
                  {drivers
                    .filter((driver) => {
                      // Filter out drivers already assigned to this vehicle
                      const vehicle = vehicles.find((v) => v.id === selectedVehicle);
                      const isAssigned = vehicle?.drivers?.some(vd => vd.driverId === driver.id);
                      return driver.status === "active" && !isAssigned;
                    })
                    .map((driver) => (
                      <SelectItem key={driver.id} value={driver.id}>
                        {driver.name} ({driver.email})
                        {driver.hasVehicle && driver.vehicleId !== selectedVehicle && (
                          <span className="text-muted-foreground">
                            {" "}
                            - Currently has {driver.vehicleReg}
                          </span>
                        )}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsAllocateDialogOpen(false);
                setSelectedVehicle(null);
              }}
              disabled={allocateVehicle.isPending}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Vehicle Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Vehicle</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this vehicle? This action cannot be undone. The
              vehicle must not be allocated to any driver.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setSelectedVehicle(null);
              }}
              disabled={deleteVehicle.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteVehicle.isPending}
            >
              {deleteVehicle.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Vehicles;
