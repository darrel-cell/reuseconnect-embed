import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Building2, 
  Bell, 
  Link2, 
  Save,
  User,
  Settings as SettingsIcon,
  AlertCircle,
  Loader2,
  Truck
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useTenantTheme } from "@/contexts/TenantThemeContext";
import { authService } from "@/services/auth.service";
import { useQueryClient } from "@tanstack/react-query";
import { useDriver, useUpdateDriverProfile } from "@/hooks/useDrivers";
import { useClientProfile, useUpdateClientProfile } from "@/hooks/useClients";
import { useOrganisationProfile, useOrganisationProfileComplete, useUpdateOrganisationProfile } from "@/hooks/useOrganisationProfile";

// Default notification preferences used for initial state and "unsaved changes" checks
const defaultNotifications = {
  email: true,
  jobAssignments: true,
  routeUpdates: true,
  collectionReminders: true,
  certificateAvailability: true,
  esgReports: false,
  clientActivity: true,
};

const Settings = () => {
  const { user } = useAuth();
  const { tenantName } = useTenantTheme();
  const queryClient = useQueryClient();
  const isHeadOfOperation = user?.role === 'head_of_operation';
  const isReseller = user?.role === 'partner';
  const isAdmin = user?.role === 'admin';
  const isAdminLike = isAdmin || isHeadOfOperation;
  const isClient = user?.role === 'client';
  const isDriver = user?.role === 'driver';
  const isDriverLike = isDriver || isHeadOfOperation;
  const isWarehouseTechnician = user?.role === 'warehouse_technician';

  // Driver profile data
  const { data: driverProfile, isLoading: isLoadingDriver } = useDriver(isDriverLike ? user?.id || null : null);
  const updateDriverProfile = useUpdateDriverProfile();

  // Client profile data
  const { data: clientProfile, isLoading: isLoadingClient } = useClientProfile();
  const updateClientProfile = useUpdateClientProfile();

  // Organisation profile data (for reseller/admin-like roles)
  const { data: organisationProfile, isLoading: isLoadingOrgProfile } = useOrganisationProfile();
  const {
    data: isOrganisationProfileComplete,
    isLoading: isLoadingOrganisationProfileComplete,
  } = useOrganisationProfileComplete(isReseller || isHeadOfOperation);
  const updateOrganisationProfile = useUpdateOrganisationProfile();

  // Driver profile form state
  const [driverFormData, setDriverFormData] = useState({
    name: '',
    email: '',
    phone: '',
  });
  const [driverInitialFormData, setDriverInitialFormData] = useState({
    name: '',
    email: '',
    phone: '',
  });

  // Warehouse technician profile form state
  const [warehouseFormData, setWarehouseFormData] = useState({
    name: '',
    email: '',
    phone: '',
  });
  const [warehouseInitialFormData, setWarehouseInitialFormData] = useState({
    name: '',
    email: '',
    phone: '',
  });
  const [isSavingWarehouseProfile, setIsSavingWarehouseProfile] = useState(false);

  // Client profile form state
  const [clientFormData, setClientFormData] = useState({
    name: '',
    email: '',
    phone: '',
    organisationName: '',
    registrationNumber: '',
    address: '',
  });
  const [clientInitialFormData, setClientInitialFormData] = useState({
    name: '',
    email: '',
    phone: '',
    organisationName: '',
    registrationNumber: '',
    address: '',
  });

  // Reseller / Admin organisation details state
  const [orgFormData, setOrgFormData] = useState({
    name: '',
    organisationName: '',
    registrationNumber: '',
    address: '',
    email: '',
    phone: '',
  });
  const [orgInitialFormData, setOrgInitialFormData] = useState({
    name: '',
    organisationName: '',
    registrationNumber: '',
    address: '',
    email: '',
    phone: '',
  });

  // Load driver profile data when available
  useEffect(() => {
    if (driverProfile && isDriverLike) {
      const next = {
        name: user?.name || '',
        email: user?.email || '',
        phone: driverProfile.phone || '',
      };
      setDriverFormData(next);
      setDriverInitialFormData(next);
    } else if (isDriverLike && !driverProfile && !isLoadingDriver) {
      // Initialize with defaults if no profile exists
      const next = {
        name: user?.name || '',
        email: user?.email || '',
        phone: '',
      };
      setDriverFormData(next);
      setDriverInitialFormData(next);
    }
  }, [driverProfile, isDriverLike, isLoadingDriver, user?.name, user?.email]);

  useEffect(() => {
    if (!isWarehouseTechnician) return;
    const next = {
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
    };
    setWarehouseFormData(next);
    setWarehouseInitialFormData(next);
  }, [isWarehouseTechnician, user?.name, user?.email, user?.phone]);

  // Load client profile data when available
  useEffect(() => {
    if (clientProfile && isClient) {
      const next = {
        name: user?.name || '',
        email: clientProfile.email || '',
        phone: clientProfile.phone || '',
        // When a real client profile exists, use its organisationName (no mock fallback)
        organisationName: clientProfile.organisationName || '',
        registrationNumber: clientProfile.registrationNumber || '',
        address: clientProfile.address || '',
      };
      setClientFormData(next);
      setClientInitialFormData(next);
    } else if (isClient && !clientProfile && !isLoadingClient) {
      // Initialize with empty values if no profile exists
      const next = {
        name: user?.name || '',
        email: user?.email || '',
        phone: '',
        // After accept invitation, organisation name should be empty for client role
        organisationName: '',
        registrationNumber: '',
        address: '',
      };
      setClientFormData(next);
      setClientInitialFormData(next);
    }
  }, [clientProfile, isClient, isLoadingClient, user?.email, user?.name, tenantName]);

  // Load organisation details for admin / reseller from API
  useEffect(() => {
    if (!isAdminLike && !isReseller) return;
    if (isLoadingOrgProfile) return;

    if (organisationProfile) {
      // Load from API
      const next = {
        name: user?.name || '',
        organisationName: organisationProfile.organisationName || '',
        registrationNumber: organisationProfile.registrationNumber || '',
        address: organisationProfile.address || '',
        email: organisationProfile.email || user?.email || '',
        phone: organisationProfile.phone || '',
      };
      setOrgFormData(next);
      setOrgInitialFormData(next);
    } else {
      // No profile exists yet - initialize with defaults
      const next = {
        name: user?.name || '',
        organisationName: isAdminLike ? (tenantName || user?.tenantName || '') : '',
        registrationNumber: '',
        address: '',
        email: user?.email || '',
        phone: '',
      };
      setOrgFormData(next);
      setOrgInitialFormData(next);
    }
  }, [organisationProfile, isLoadingOrgProfile, isAdminLike, isReseller, tenantName, user?.tenantName, user?.email, user?.name]);

  const hasIncompleteDriverProfile =
    isDriverLike && !isLoadingDriver && (!driverProfile || !driverProfile.hasProfile);

  const hasIncompleteOrganisationProfile =
    (isReseller || isHeadOfOperation) &&
    !isLoadingOrganisationProfileComplete &&
    !isOrganisationProfileComplete;

  // Notification state management
  const [notifications, setNotifications] = useState(defaultNotifications);

  const handleNotificationChange = (key: keyof typeof notifications, value: boolean) => {
    setNotifications(prev => ({ ...prev, [key]: value }));
    toast.success(`Notification ${value ? 'enabled' : 'disabled'}`);
  };

  // Change detection for profile sections
  const hasDriverProfileChanges =
    isDriverLike &&
    (
      driverFormData.name.trim() !== driverInitialFormData.name.trim() ||
      driverFormData.email.trim() !== driverInitialFormData.email.trim() ||
      driverFormData.phone.trim() !== driverInitialFormData.phone.trim()
    );

  const hasClientProfileChanges =
    isClient &&
    (
      clientFormData.name.trim() !== clientInitialFormData.name.trim() ||
      clientFormData.email.trim() !== clientInitialFormData.email.trim() ||
      clientFormData.phone.trim() !== clientInitialFormData.phone.trim() ||
      clientFormData.organisationName.trim() !== clientInitialFormData.organisationName.trim() ||
      clientFormData.registrationNumber.trim() !== clientInitialFormData.registrationNumber.trim() ||
      clientFormData.address.trim() !== clientInitialFormData.address.trim()
    );

  const hasWarehouseProfileChanges =
    isWarehouseTechnician &&
    (
      warehouseFormData.name.trim() !== warehouseInitialFormData.name.trim() ||
      warehouseFormData.email.trim() !== warehouseInitialFormData.email.trim() ||
      warehouseFormData.phone.trim() !== warehouseInitialFormData.phone.trim()
    );

  const handleSaveDriverProfile = () => {
    if (!user?.id) return;

    if (!driverFormData.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!driverFormData.email.trim()) {
      toast.error("Email is required");
      return;
    }
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(driverFormData.email.trim())) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (!driverFormData.phone.trim()) {
      toast.error("Phone number is required");
      return;
    }

    updateDriverProfile.mutate(
      {
        driverId: user.id,
        data: {
          name: driverFormData.name.trim(),
          email: driverFormData.email.trim(),
          phone: driverFormData.phone.trim(),
        },
      },
      {
        onSuccess: async () => {
          const updatedData = {
            name: driverFormData.name.trim(),
            email: driverFormData.email.trim(),
            phone: driverFormData.phone.trim(),
          };
          setDriverInitialFormData(updatedData);
          toast.success("Driver profile updated successfully");
          queryClient.invalidateQueries({ queryKey: ['drivers', user.id] });
          // Refresh auth to get updated user name and email
          const auth = await authService.getCurrentAuth();
          if (auth && auth.user) {
            // Update user in context by reloading page to refresh all user data
            setTimeout(() => {
              window.location.reload();
            }, 500); // Small delay to ensure toast is visible
          }
        },
        onError: (error) => {
          toast.error("Failed to update driver profile", {
            description: error instanceof Error ? error.message : "Please try again.",
          });
        },
      }
    );
  };

  const handleSaveWarehouseProfile = async () => {
    if (!warehouseFormData.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!warehouseFormData.email.trim()) {
      toast.error("Email is required");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(warehouseFormData.email.trim())) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (!warehouseFormData.phone.trim()) {
      toast.error("Phone number is required");
      return;
    }

    setIsSavingWarehouseProfile(true);
    try {
      await authService.updateProfile({
        name: warehouseFormData.name.trim(),
        email: warehouseFormData.email.trim(),
        phone: warehouseFormData.phone.trim(),
      });

      const updated = {
        name: warehouseFormData.name.trim(),
        email: warehouseFormData.email.trim(),
        phone: warehouseFormData.phone.trim(),
      };
      setWarehouseInitialFormData(updated);
      toast.success("Profile updated successfully");
      window.location.reload();
    } catch (error) {
      toast.error("Failed to update profile", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsSavingWarehouseProfile(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h2 className="text-2xl font-bold text-foreground">Settings</h2>
          <p className="text-muted-foreground">
            {isAdminLike && "Manage platform settings, organisation details, and user access"}
            {isClient && "Manage your organisation details and preferences"}
            {isReseller && "Manage your organisation and client settings"}
            {isDriver && "Manage your profile and notification preferences"}
            {isWarehouseTechnician && "Manage your profile and account settings"}
          </p>
      </motion.div>

      {/* Profile Settings - For Warehouse Technician */}
      {isWarehouseTechnician && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-5 w-5" />
                Profile Information
              </CardTitle>
              <CardDescription>
                Update your contact information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                  <Label htmlFor="warehouseName">Full Name</Label>
                  <Input
                    id="warehouseName"
                    value={warehouseFormData.name}
                    onChange={(e) => setWarehouseFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="warehouseEmail">Email</Label>
                  <Input
                    id="warehouseEmail"
                    type="email"
                    placeholder="warehouse@example.com"
                    value={warehouseFormData.email}
                    onChange={(e) => setWarehouseFormData(prev => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="warehousePhone">Phone Number</Label>
                  <Input
                    id="warehousePhone"
                    type="tel"
                    placeholder="+44 7700 900123"
                    value={warehouseFormData.phone}
                    onChange={(e) => {
                      const value = e.target.value;
                      const phoneRegex = /^[+]?[0-9\s\-()]*$/;
                      if (phoneRegex.test(value) || value === '') {
                        setWarehouseFormData(prev => ({ ...prev, phone: value }));
                      }
                    }}
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end pt-4">
                <Button
                  variant="default"
                  onClick={handleSaveWarehouseProfile}
                  size="lg"
                  disabled={
                    isSavingWarehouseProfile ||
                    !warehouseFormData.name.trim() ||
                    !warehouseFormData.email.trim() ||
                    !warehouseFormData.phone.trim() ||
                    !hasWarehouseProfileChanges
                  }
                >
                  {isSavingWarehouseProfile ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Profile
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Driver Profile Incomplete Notification */}
      {hasIncompleteDriverProfile && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <Alert className="bg-warning/10 border-warning/20">
            <AlertCircle className="h-5 w-5 text-warning" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-semibold text-warning-foreground">
                  Driver Profile Completion Required
                </p>
                <p className="text-sm text-muted-foreground">
                  To continue, please complete your driver profile by providing your name, email, and phone number below. Vehicle allocation is managed separately by an administrator.
                </p>
              </div>
            </AlertDescription>
          </Alert>
        </motion.div>
      )}

      {/* Client Profile Incomplete Notification */}
      {isClient && !isLoadingClient && (!clientProfile || !clientProfile.hasProfile) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <Alert className="bg-warning/10 border-warning/20">
            <AlertCircle className="h-5 w-5 text-warning" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-semibold text-warning-foreground">
                  Profile Completion Required
                </p>
                <p className="text-sm text-muted-foreground">
                  To access all features and create bookings, please complete your client profile by providing your contact information (email and phone) and organisation details (organisation name, registration number, and address) below. Once your profile is complete, you'll be able to use all platform features.
                </p>
              </div>
            </AlertDescription>
          </Alert>
        </motion.div>
      )}

      {/* Organisation Profile Incomplete Notification */}
      {hasIncompleteOrganisationProfile && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <Alert className="bg-warning/10 border-warning/20">
            <AlertCircle className="h-5 w-5 text-warning" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-semibold text-warning-foreground">
                  Organisation Profile Completion Required
                </p>
                <p className="text-sm text-muted-foreground">
                  Please complete your organisation details below, including organisation name, registration number, registered address, email, and phone number.
                </p>
              </div>
            </AlertDescription>
          </Alert>
        </motion.div>
      )}

      {/* Profile Settings - For Drivers */}
      {isDriverLike && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-5 w-5" />
                Driver Profile Information
              </CardTitle>
              <CardDescription>
                Update your vehicle information and contact details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingDriver ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="grid sm:grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2">
                      <Label htmlFor="driverName">Full Name</Label>
                      <Input 
                        id="driverName" 
                        value={driverFormData.name}
                        onChange={(e) => setDriverFormData(prev => ({ ...prev, name: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="driverEmail">Email</Label>
                      <Input 
                        id="driverEmail" 
                        type="email"
                        placeholder="driver@example.com"
                        value={driverFormData.email}
                        onChange={(e) => setDriverFormData(prev => ({ ...prev, email: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                  <Separator />
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="driverPhone">Phone Number</Label>
                      <Input 
                        id="driverPhone" 
                        type="tel"
                        placeholder="+44 7700 900123"
                        value={driverFormData.phone}
                        onChange={(e) => {
                          const value = e.target.value;
                          // Only allow numbers, spaces, hyphens, parentheses, and plus sign at the start
                          const phoneRegex = /^[+]?[0-9\s\-()]*$/;
                          if (phoneRegex.test(value) || value === '') {
                            setDriverFormData(prev => ({ ...prev, phone: value }));
                          }
                        }}
                        required
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button 
                      variant="default" 
                      onClick={handleSaveDriverProfile} 
                      size="lg"
                      disabled={
                        updateDriverProfile.isPending ||
                        !driverFormData.name.trim() ||
                        !driverFormData.email.trim() ||
                        !driverFormData.phone.trim() ||
                        !hasDriverProfileChanges
                      }
                    >
                      {updateDriverProfile.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save Driver Profile
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Vehicle Information - For Drivers (Read-only) */}
      {isDriverLike && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Truck className="h-5 w-5" />
                Vehicle Information
              </CardTitle>
              <CardDescription>
                Your allocated vehicle details (managed by administrator)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingDriver ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : driverProfile?.hasVehicle && driverProfile.vehicleReg ? (
                <div className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Vehicle Registration</Label>
                      <div className="flex items-center gap-2 p-3 bg-muted rounded-md border">
                        <Truck className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono font-medium">{driverProfile.vehicleReg}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Vehicle Type</Label>
                      <div className="flex items-center gap-2 p-3 bg-muted rounded-md border">
                        <Truck className="h-4 w-4 text-muted-foreground" />
                        <span className="capitalize">{driverProfile.vehicleType || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Fuel Type</Label>
                      <div className="flex items-center gap-2 p-3 bg-muted rounded-md border">
                        <Truck className="h-4 w-4 text-muted-foreground" />
                        <span className="capitalize">{driverProfile.vehicleFuelType || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No vehicle has been allocated to you yet. Please contact your administrator to have a vehicle assigned.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Organisation Settings - For Clients (aligned with Admin/Reseller style) */}
      {isClient && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-5 w-5" />
                Organisation Details
              </CardTitle>
              <CardDescription>
                Your organisation information used for bookings, client-facing communications, reports, and certificates
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingClient ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium mb-3">Contact Information</h4>
                      <div className="grid sm:grid-cols-2 gap-4 mb-4">
                        <div className="space-y-2">
                          <Label htmlFor="clientName">Contact Name</Label>
                          <Input 
                            id="clientName" 
                            value={clientFormData.name}
                            onChange={(e) => setClientFormData(prev => ({ ...prev, name: e.target.value }))}
                            required
                          />
                        </div>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="clientEmail">Email Address</Label>
                          <Input 
                            id="clientEmail" 
                            type="email"
                            placeholder="client@example.com"
                            value={clientFormData.email}
                            onChange={(e) => setClientFormData(prev => ({ ...prev, email: e.target.value }))}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="clientPhone">Phone Number</Label>
                          <Input 
                            id="clientPhone" 
                            type="tel"
                            placeholder="+44 20 1234 5678"
                            value={clientFormData.phone}
                            onChange={(e) => {
                              const value = e.target.value;
                              // Only allow numbers, spaces, hyphens, parentheses, and plus sign at the start
                              const phoneRegex = /^[+]?[0-9\s\-()]*$/;
                              if (phoneRegex.test(value) || value === '') {
                                setClientFormData(prev => ({ ...prev, phone: value }));
                              }
                            }}
                            required
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h4 className="text-sm font-medium mb-3">Organisation Information</h4>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="orgName">Organisation Name</Label>
                          <Input 
                            id="orgName" 
                            value={clientFormData.organisationName}
                            onChange={(e) => setClientFormData(prev => ({ ...prev, organisationName: e.target.value }))}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="regNumber">Registration Number</Label>
                          <Input 
                            id="regNumber" 
                            value={clientFormData.registrationNumber}
                            onChange={(e) => setClientFormData(prev => ({ ...prev, registrationNumber: e.target.value }))}
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2 mt-4">
                        <Label htmlFor="address">Registered Address</Label>
                        <Input 
                          id="address" 
                          value={clientFormData.address}
                          onChange={(e) => setClientFormData(prev => ({ ...prev, address: e.target.value }))}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      onClick={() => {
                        if (!clientFormData.name.trim() || !clientFormData.email.trim() || !clientFormData.phone.trim()) {
                          toast.error("Contact name, email and phone number are required");
                          return;
                        }
                        if (!clientFormData.organisationName.trim() || !clientFormData.registrationNumber.trim() || !clientFormData.address.trim()) {
                          toast.error("All organisation details are required");
                          return;
                        }
                        updateClientProfile.mutate(
                          {
                            name: clientFormData.name.trim(),
                            email: clientFormData.email.trim(),
                            phone: clientFormData.phone.trim(),
                            organisationName: clientFormData.organisationName.trim(),
                            registrationNumber: clientFormData.registrationNumber.trim(),
                            address: clientFormData.address.trim(),
                          },
                          {
                            onSuccess: async () => {
                              setClientInitialFormData({
                                name: clientFormData.name.trim(),
                                email: clientFormData.email.trim(),
                                phone: clientFormData.phone.trim(),
                                organisationName: clientFormData.organisationName.trim(),
                                registrationNumber: clientFormData.registrationNumber.trim(),
                                address: clientFormData.address.trim(),
                              });
                              // Refresh auth to get updated user name
                              const auth = await authService.getCurrentAuth();
                              if (auth && auth.user) {
                                // Update user in context by reloading page to refresh all user data
                                window.location.reload();
                              }
                              toast.success("Client profile updated successfully");
                            },
                            onError: (error) => {
                              toast.error("Failed to update client profile", {
                                description: error instanceof Error ? error.message : "Please try again.",
                              });
                            },
                          }
                        );
                      }}
                      disabled={
                        updateClientProfile.isPending || 
                        !clientFormData.name.trim() ||
                        !clientFormData.email.trim() || 
                        !clientFormData.phone.trim() ||
                        !clientFormData.organisationName.trim() ||
                        !clientFormData.registrationNumber.trim() ||
                        !clientFormData.address.trim() ||
                        !hasClientProfileChanges
                      }
                    >
                      {updateClientProfile.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save Organisation Details
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Organisation Settings - For Admin and Reseller */}
      {(isAdminLike || isReseller) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-5 w-5" />
                Organisation Details
              </CardTitle>
              <CardDescription>
                {isAdminLike && "Platform-wide organisation information"}
                {isReseller && "Your company information used for client-facing communications, reports, and certificates"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                {!isHeadOfOperation && (
                  <>
                    {/* Contact Information */}
                    <div>
                      <h4 className="text-sm font-medium mb-3">Contact Information</h4>
                      <div className="grid sm:grid-cols-2 gap-4 mb-4">
                        <div className="space-y-2">
                          <Label htmlFor="resellerFullName">Contact Name</Label>
                          <Input
                            id="resellerFullName"
                            value={orgFormData.name}
                            onChange={(e) =>
                              setOrgFormData(prev => ({ ...prev, name: e.target.value }))
                            }
                            required
                          />
                        </div>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="email">Email Address</Label>
                          <Input
                            id="email"
                            type="email"
                            value={orgFormData.email}
                            onChange={(e) =>
                              setOrgFormData(prev => ({ ...prev, email: e.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="phone">Phone Number</Label>
                          <Input
                            id="phone"
                            type="tel"
                            placeholder="+44 20 1234 5678"
                            value={orgFormData.phone}
                            onChange={(e) => {
                              const value = e.target.value;
                              // Only allow numbers, spaces, hyphens, parentheses, and plus sign at the start
                              const phoneRegex = /^[+]?[0-9\s\-()]*$/;
                              if (phoneRegex.test(value) || value === '') {
                                setOrgFormData(prev => ({ ...prev, phone: value }));
                              }
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />
                  </>
                )}

                {/* Organisation Details */}
                <div>
                  <h4 className="text-sm font-medium mb-3">Organisation Information</h4>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="orgName">Organisation Name</Label>
                  <Input
                    id="orgName"
                    value={orgFormData.organisationName}
                    onChange={(e) =>
                      setOrgFormData(prev => ({ ...prev, organisationName: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="regNumber">Registration Number</Label>
                  <Input
                    id="regNumber"
                    value={orgFormData.registrationNumber}
                    onChange={(e) =>
                      setOrgFormData(prev => ({ ...prev, registrationNumber: e.target.value }))
                    }
                  />
                </div>
              </div>
                  <div className="space-y-2 mt-4">
                <Label htmlFor="address">Registered Address</Label>
                <Input
                  id="address"
                  value={orgFormData.address}
                  onChange={(e) =>
                    setOrgFormData(prev => ({ ...prev, address: e.target.value }))
                  }
                />
              </div>
                </div>
              </div>
              {(isAdminLike || isReseller) && (
                <div className="flex justify-end pt-2">
                  <Button
                    onClick={() => {
                      const resolvedName = isHeadOfOperation ? driverFormData.name.trim() : orgFormData.name.trim();
                      const resolvedEmail = isHeadOfOperation ? driverFormData.email.trim() : orgFormData.email.trim();
                      const resolvedPhone = isHeadOfOperation ? driverFormData.phone.trim() : orgFormData.phone.trim();

                      if (!resolvedName ||
                          !orgFormData.organisationName.trim() ||
                          !orgFormData.registrationNumber.trim() ||
                          !orgFormData.address.trim() ||
                          !resolvedEmail ||
                          !resolvedPhone) {
                        toast.error("All fields are required");
                        return;
                      }

                      const payload = {
                        name: resolvedName,
                        organisationName: orgFormData.organisationName.trim(),
                        registrationNumber: orgFormData.registrationNumber.trim(),
                        address: orgFormData.address.trim(),
                        email: resolvedEmail,
                        phone: resolvedPhone,
                      };

                      updateOrganisationProfile.mutate(payload, {
                        onSuccess: () => {
                          setOrgInitialFormData(payload);
                          // Refresh relevant cached data without a full page reload.
                          queryClient.invalidateQueries({ queryKey: ['organisation-profile'] });
                          queryClient.invalidateQueries({ queryKey: ['organisation-profile', 'complete'] });
                          queryClient.invalidateQueries({ queryKey: ['auth'] });
                          toast.success("Organisation details saved successfully");
                        },
                        onError: (error) => {
                          toast.error("Failed to save organisation details", {
                            description: error instanceof Error ? error.message : "Please try again.",
                          });
                        },
                      });
                    }}
                    disabled={
                      updateOrganisationProfile.isPending ||
                      // Require all fields AND at least one has changed from last saved values
                      !(isHeadOfOperation ? driverFormData.name.trim() : orgFormData.name.trim()) ||
                      !orgFormData.organisationName.trim() ||
                      !orgFormData.registrationNumber.trim() ||
                      !orgFormData.address.trim() ||
                      !(isHeadOfOperation ? driverFormData.email.trim() : orgFormData.email.trim()) ||
                      !(isHeadOfOperation ? driverFormData.phone.trim() : orgFormData.phone.trim()) ||
                      (
                        (isHeadOfOperation ? driverFormData.name.trim() : orgFormData.name.trim()) === orgInitialFormData.name.trim() &&
                        orgFormData.organisationName.trim() === orgInitialFormData.organisationName.trim() &&
                        orgFormData.registrationNumber.trim() === orgInitialFormData.registrationNumber.trim() &&
                        orgFormData.address.trim() === orgInitialFormData.address.trim() &&
                        (isHeadOfOperation ? driverFormData.email.trim() : orgFormData.email.trim()) === orgInitialFormData.email.trim() &&
                        (isHeadOfOperation ? driverFormData.phone.trim() : orgFormData.phone.trim()) === orgInitialFormData.phone.trim()
                      )
                    }
                  >
                    {updateOrganisationProfile.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Organisation Details
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}


      {/* Notifications - All roles with functional toggles */}
      {/* Temporarily hidden */}
      {false && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: isDriver ? 0.2 : 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bell className="h-5 w-5" />
                Notifications
              </CardTitle>
              <CardDescription>
                Configure how and when you receive updates. Toggle notifications on or off as needed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Common notifications - Email */}
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className="flex-1">
                  <p className="font-medium mb-1">Email notifications</p>
                  <p className="text-sm text-muted-foreground">
                    {isDriver && "Receive updates about assigned jobs"}
                    {!isDriver && "Receive updates about job status changes"}
                  </p>
                </div>
                <Switch 
                  checked={notifications.email}
                  onCheckedChange={(checked) => handleNotificationChange('email', checked)}
                  className="data-[state=checked]:bg-success"
                />
              </div>
              
              {/* Driver-specific notifications */}
              {isDriver && (
                <>
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="flex-1">
                      <p className="font-medium mb-1">Job assignments</p>
                      <p className="text-sm text-muted-foreground">Get notified when new jobs are assigned to you</p>
                    </div>
                    <Switch 
                      checked={notifications.jobAssignments}
                      onCheckedChange={(checked) => handleNotificationChange('jobAssignments', checked)}
                      className="data-[state=checked]:bg-success"
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="flex-1">
                      <p className="font-medium mb-1">Route updates</p>
                      <p className="text-sm text-muted-foreground">Receive updates about route changes or delays</p>
                    </div>
                    <Switch 
                      checked={notifications.routeUpdates}
                      onCheckedChange={(checked) => handleNotificationChange('routeUpdates', checked)}
                      className="data-[state=checked]:bg-success"
                    />
                  </div>
                </>
              )}
              
              {/* Client/Reseller/Admin notifications */}
              {!isDriver && (
                <>
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="flex-1">
                      <p className="font-medium mb-1">Collection reminders</p>
                      <p className="text-sm text-muted-foreground">Get notified 24h before scheduled collections</p>
                    </div>
                    <Switch 
                      checked={notifications.collectionReminders}
                      onCheckedChange={(checked) => handleNotificationChange('collectionReminders', checked)}
                      className="data-[state=checked]:bg-success"
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="flex-1">
                      <p className="font-medium mb-1">Certificate availability</p>
                      <p className="text-sm text-muted-foreground">Notify when new certificates are ready</p>
                    </div>
                    <Switch 
                      checked={notifications.certificateAvailability}
                      onCheckedChange={(checked) => handleNotificationChange('certificateAvailability', checked)}
                      className="data-[state=checked]:bg-success"
                    />
                  </div>
                  {(isAdmin || isClient) && (
                    <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                      <div className="flex-1">
                        <p className="font-medium mb-1">ESG report summaries</p>
                        <p className="text-sm text-muted-foreground">Weekly environmental impact digests</p>
                      </div>
                      <Switch 
                        checked={notifications.esgReports}
                        onCheckedChange={(checked) => handleNotificationChange('esgReports', checked)}
                        className="data-[state=checked]:bg-success"
                      />
                    </div>
                  )}
                  {isReseller && (
                    <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                      <div className="flex-1">
                        <p className="font-medium mb-1">Client activity</p>
                        <p className="text-sm text-muted-foreground">Get notified about your clients' bookings and jobs</p>
                      </div>
                      <Switch 
                        checked={notifications.clientActivity}
                        onCheckedChange={(checked) => handleNotificationChange('clientActivity', checked)}
                        className="data-[state=checked]:bg-success"
                      />
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Integrations - Admin only */}
      {/* Temporarily hidden */}
      {false && isAdmin && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Link2 className="h-5 w-5" />
                Integrations
              </CardTitle>
              <CardDescription>
                Manage platform-wide system integrations with external services
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                    <span className="text-lg">📊</span>
                  </div>
                  <div>
                    <p className="font-medium">ERP System</p>
                    <p className="text-sm text-muted-foreground">
                      Platform ERP integration for automated data synchronization
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-success/10 text-success">Connected</Badge>
                  <Button variant="outline" size="sm">
                    <SettingsIcon className="h-4 w-4 mr-2" />
                    Configure
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                    <span className="text-lg">💾</span>
                  </div>
                  <div>
                    <p className="font-medium">Blancco Data Wipe</p>
                    <p className="text-sm text-muted-foreground">
                      Sanitisation system integration for automated certificate generation
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-success/10 text-success">Connected</Badge>
                  <Button variant="outline" size="sm">
                    <SettingsIcon className="h-4 w-4 mr-2" />
                    Configure
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
};

export default Settings;
