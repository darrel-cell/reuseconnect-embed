import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Calendar, MapPin, Phone, User, Laptop, ArrowRight, ArrowLeft, Loader2, CheckCircle2, Plus, X, Building2, AlertCircle, UserPlus, Package, Calculator, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAssetCategories } from "@/hooks/useAssets";
import { useBuybackCalculation } from "@/hooks/useBuyback";
import { jmlBookingService } from "@/services/jml-booking.service";
import { Mail } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useClients, useClientProfile } from "@/hooks/useClients";
import { useSites, useCreateSite } from "@/hooks/useSites";
import { geocodeAddressWithDetails, calculateRoundTripDistance } from "@/lib/calculations";
import { validateEuropeanPostcode } from "@/lib/european-validation";
import { MapPicker } from "@/components/booking/MapPicker";
import { DatePicker } from "@/components/booking/DatePicker";
import { BuybackEstimateDisclaimer } from "@/components/booking/BuybackEstimateDisclaimer";
import { cn } from "@/lib/utils";
import { filterJmlAssetCategories, getDeviceTypeOptionsForJmlCategory, getUnderlyingAssetCategoryNameForJml, inferDeviceTypeFromJmlCategory, isAccessoriesCategory, shouldShowDeviceTypeForJmlCategory, type JmlDeviceType } from "@/lib/jml-assets";
import { useCO2Calculation } from "@/hooks/useCO2";
import { co2eEquivalencies } from "@/lib/constants";

interface CurrentDevice {
  make: string;
  model: string;
  category: string;
  quantity: number;
  deviceType: JmlDeviceType;
  notes?: string;
}

const steps = [
  { id: 1, title: "Employee & Addresses", icon: User },
  { id: 2, title: "Devices", icon: Package },
  { id: 3, title: "Review & Submit", icon: Calculator },
];

const JMLMover = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: assetCategories = [] } = useAssetCategories();
  const jmlAssetCategories = useMemo(() => filterJmlAssetCategories(assetCategories), [assetCategories]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Role flags
  const isAdmin = user?.role === "admin";
  const isReseller = user?.role === "partner";
  const isClient = user?.role === "client";

  const { data: clientProfile } = useClientProfile();

  // Client & site selection (admin/reseller) - mirror ITAD collection site step
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedCurrentSiteId, setSelectedCurrentSiteId] = useState<string>("new");
  const [selectedNewSiteId, setSelectedNewSiteId] = useState<string>("new");

  // Load clients (admin/reseller only)
  const { data: allClients = [], isLoading: isLoadingClients, error: clientsError } = useClients({ status: "active" });
  const clients = useMemo(() => {
    return allClients.filter((client) => client.status === "active");
  }, [allClients]);

  // Load sites - for admin/reseller: based on selectedClientId, for client: all their sites
  const { data: sites = [], isLoading: isLoadingSites } = useSites(
    (isAdmin || isReseller) ? selectedClientId : undefined
  );
  const createSite = useCreateSite();

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [hasTouchedEmailPhone, setHasTouchedEmailPhone] = useState(false);
  const [moveDate, setMoveDate] = useState<Date | undefined>(undefined);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [newLocation, setNewLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [moverDistanceKm, setMoverDistanceKm] = useState<number>(0);
  const [isCalculatingMoverDistance, setIsCalculatingMoverDistance] = useState(false);
  const [isGeocodingCurrentAddress, setIsGeocodingCurrentAddress] = useState(false);
  const [isGeocodingNewAddress, setIsGeocodingNewAddress] = useState(false);
  const [currentDevices, setCurrentDevices] = useState<CurrentDevice[]>([
    { make: "", model: "", category: "", quantity: 1, deviceType: 'Windows' }
  ]);

  // Structured address fields for current address
  const [currentAddressDetails, setCurrentAddressDetails] = useState({
    siteName: "",
    street: "",
    city: "",
    county: "",
    postcode: "",
    country: "",
  });

  // Structured address fields for new address
  const [newAddressDetails, setNewAddressDetails] = useState({
    siteName: "",
    street: "",
    city: "",
    county: "",
    postcode: "",
    country: "",
  });

  // Reset site selection when client changes (for admin/reseller)
  useEffect(() => {
    if ((isAdmin || isReseller) && selectedClientId) {
      setSelectedCurrentSiteId("new");
      setSelectedNewSiteId("new");
      setHasTouchedEmailPhone(false);
      setCurrentAddressDetails({
        siteName: "",
        street: "",
        city: "",
        county: "",
        postcode: "",
        country: "",
      });
      setNewAddressDetails({
        siteName: "",
        street: "",
        city: "",
        county: "",
        postcode: "",
        country: "",
      });
      setCurrentLocation(null);
      setNewLocation(null);
    }
  }, [selectedClientId, isAdmin, isReseller]);

  // Default email/phone for step 1 (does not override user edits)
  useEffect(() => {
    if (hasTouchedEmailPhone) return;

    if (isClient && clientProfile) {
      setEmail(clientProfile.email || "");
      setPhone(clientProfile.phone || "");
      return;
    }

    if ((isAdmin || isReseller) && selectedClientId) {
      const selectedClient = clients.find(c => c.id === selectedClientId);
      if (selectedClient) {
        setEmail(selectedClient.email || "");
        setPhone(selectedClient.contactPhone || "");
      }
    }
  }, [hasTouchedEmailPhone, isClient, clientProfile, isAdmin, isReseller, selectedClientId, clients]);

  // Auto-geocode postcode for current address
  useEffect(() => {
    if (selectedCurrentSiteId !== 'new' || !currentAddressDetails.postcode.trim()) {
      return;
    }

    if (!validateEuropeanPostcode(currentAddressDetails.postcode, currentAddressDetails.country)) {
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsGeocodingCurrentAddress(true);
      try {
        const result = await geocodeAddressWithDetails(currentAddressDetails.postcode);
        if (result && result.coordinates) {
          setCurrentLocation({ lat: result.coordinates.lat, lng: result.coordinates.lng });
          if (result.address) {
            setCurrentAddressDetails(prev => ({
              ...prev,
              street: prev.street.trim() || result.address?.street || prev.street,
              city: prev.city.trim() || result.address?.city || prev.city,
              county: prev.county.trim() || result.address?.county || prev.county,
              postcode: prev.postcode.trim() || result.address?.postcode || prev.postcode,
              country: prev.country.trim() || result.address?.country || prev.country,
            }));
          }
        }
      } catch (error) {
        console.error("Geocoding error:", error);
        setCurrentLocation(null);
      } finally {
        setIsGeocodingCurrentAddress(false);
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [currentAddressDetails.postcode, selectedCurrentSiteId]);

  // Auto-geocode postcode for new address
  useEffect(() => {
    if (selectedNewSiteId !== 'new' || !newAddressDetails.postcode.trim()) {
      return;
    }

    if (!validateEuropeanPostcode(newAddressDetails.postcode, newAddressDetails.country)) {
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsGeocodingNewAddress(true);
      try {
        const result = await geocodeAddressWithDetails(newAddressDetails.postcode);
        if (result && result.coordinates) {
          setNewLocation({ lat: result.coordinates.lat, lng: result.coordinates.lng });
          if (result.address) {
            setNewAddressDetails(prev => ({
              ...prev,
              street: prev.street.trim() || result.address?.street || prev.street,
              city: prev.city.trim() || result.address?.city || prev.city,
              county: prev.county.trim() || result.address?.county || prev.county,
              postcode: prev.postcode.trim() || result.address?.postcode || prev.postcode,
              country: prev.country.trim() || result.address?.country || prev.country,
            }));
          }
        }
      } catch (error) {
        console.error("Geocoding error:", error);
        setNewLocation(null);
      } finally {
        setIsGeocodingNewAddress(false);
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [newAddressDetails.postcode, selectedNewSiteId]);

  // Calculate total mover distance for CO2 preview:
  // (warehouse → current/collection) * 2  +  (warehouse → delivery/new) * 2
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!currentLocation || !newLocation) {
        setMoverDistanceKm(0);
        return;
      }

      try {
        setIsCalculatingMoverDistance(true);
        const [currentRoundTripKm, newRoundTripKm] = await Promise.all([
          calculateRoundTripDistance(currentLocation.lat, currentLocation.lng),
          calculateRoundTripDistance(newLocation.lat, newLocation.lng),
        ]);

        if (!cancelled) {
          setMoverDistanceKm(currentRoundTripKm + newRoundTripKm);
        }
      } catch (error) {
        console.error("Error calculating mover distance for CO2 preview:", error);
        if (!cancelled) setMoverDistanceKm(0);
      } finally {
        if (!cancelled) setIsCalculatingMoverDistance(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [currentLocation, newLocation]);

  // CO2 preview should still run for accessories-only bookings (travel emissions can exist).
  const selectedAssetsForCO2 = useMemo(() => {
    const fallbackCategoryId = assetCategories[0]?.id ?? "";
    const accessoryCategoryId =
      assetCategories.find((c) => isAccessoriesCategory(c.name) || c.name.toLowerCase().includes("accessor"))
        ?.id ?? fallbackCategoryId;

    return currentDevices
      .filter((d) => d.category && d.quantity > 0)
      .map((d) => {
        const underlyingName = getUnderlyingAssetCategoryNameForJml(d.category);
        const isAccessoryDevice = isAccessoriesCategory(d.category);

        const category = isAccessoryDevice
          ? assetCategories.find(
              (c) => isAccessoriesCategory(c.name) || c.name.toLowerCase().includes("accessor")
            )
          : underlyingName
            ? assetCategories.find(
                (c) => c.name.trim().toLowerCase() === underlyingName.trim().toLowerCase()
              )
            : assetCategories.find(
                (c) => c.name.trim().toLowerCase() === String(d.category).trim().toLowerCase()
              );

        const categoryId = category?.id || (isAccessoryDevice ? accessoryCategoryId : "");
        return { categoryId, quantity: d.quantity, isAccessory: isAccessoryDevice };
      })
      .filter((a) => a.categoryId);
  }, [currentDevices, assetCategories]);

  // Buyback should ignore accessories (backend may return 0 for accessories-only anyway).
  const selectedAssetsForBuyback = useMemo(() => {
    return currentDevices
      .filter((d) => d.category && d.quantity > 0 && !isAccessoriesCategory(d.category))
      .map((d) => {
        const underlyingName = getUnderlyingAssetCategoryNameForJml(d.category);
        const category = underlyingName ? assetCategories.find((c) => c.name === underlyingName) : undefined;
        return { categoryId: category?.id || "", quantity: d.quantity };
      })
      .filter((a) => a.categoryId);
  }, [currentDevices, assetCategories]);

  // Estimated cost is per-unit processing, so include accessories too.
  const buybackCalculationRequest = useMemo(() => {
    if (selectedAssetsForBuyback.length === 0) return null;
    return { assets: selectedAssetsForBuyback };
  }, [selectedAssetsForBuyback]);

  const { data: buybackCalculation } = useBuybackCalculation(buybackCalculationRequest);
  const buybackEstimate = buybackCalculation?.estimatedBuyback ?? 0;

  const co2CalculationRequest = useMemo(() => {
    if (selectedAssetsForCO2.length === 0) return null;

    const coordinates =
      currentLocation || newLocation || { lat: 51.5074, lng: -0.1278 }; // London fallback

    return {
      assets: selectedAssetsForCO2,
      collectionCoordinates: coordinates,
      distanceKm: moverDistanceKm > 0 ? moverDistanceKm : undefined,
      vehicleType: "petrol" as const,
    };
  }, [selectedAssetsForCO2, currentLocation, newLocation, moverDistanceKm]);

  const { data: co2Calculation, isFetching: isFetchingCO2 } = useCO2Calculation(co2CalculationRequest);

  const co2eSaved = co2Calculation?.reuseSavings ?? 0;
  const travelEmissions = co2Calculation?.travelEmissions ?? 0;
  const netCO2e = co2Calculation?.netImpact ?? 0;

  // Handle current site selection
  const handleCurrentSiteSelect = (siteId: string) => {
    setSelectedCurrentSiteId(siteId);
    
    if (siteId === 'new') {
      setCurrentAddressDetails({
        siteName: "",
        street: "",
        city: "",
        county: "",
        postcode: "",
        country: "",
      });
      setCurrentLocation(null);
    } else {
      const selectedSite = sites.find(s => s.id === siteId);
      if (selectedSite) {
        const addressParts = selectedSite.address.split(',').map(s => s.trim());
        setCurrentAddressDetails({
          siteName: selectedSite.name,
          street: addressParts[0] || "",
          city: addressParts[1] || "",
          county: addressParts[2] || "",
          postcode: selectedSite.postcode,
          country: addressParts[3] || "",
        });
        if (selectedSite.lat && selectedSite.lng) {
          setCurrentLocation({ lat: selectedSite.lat, lng: selectedSite.lng });
        } else {
          setCurrentLocation(null);
        }
      }
    }
  };

  // Handle new site selection
  const handleNewSiteSelect = (siteId: string) => {
    setSelectedNewSiteId(siteId);
    
    if (siteId === 'new') {
      setNewAddressDetails({
        siteName: "",
        street: "",
        city: "",
        county: "",
        postcode: "",
        country: "",
      });
      setNewLocation(null);
    } else {
      const selectedSite = sites.find(s => s.id === siteId);
      if (selectedSite) {
        const addressParts = selectedSite.address.split(',').map(s => s.trim());
        setNewAddressDetails({
          siteName: selectedSite.name,
          street: addressParts[0] || "",
          city: addressParts[1] || "",
          county: addressParts[2] || "",
          postcode: selectedSite.postcode,
          country: addressParts[3] || "",
        });
        if (selectedSite.lat && selectedSite.lng) {
          setNewLocation({ lat: selectedSite.lat, lng: selectedSite.lng });
        } else {
          setNewLocation(null);
        }
      }
    }
  };

  // Helper function to check if Device Type should be shown for a category
  const shouldShowDeviceType = (category: string): boolean => shouldShowDeviceTypeForJmlCategory(category);

  const addCurrentDevice = () => {
    // Validate last device before adding a new one
    const last = currentDevices[currentDevices.length - 1];
    const requiresDeviceType = shouldShowDeviceType(last.category);
    const hasDeviceType = !requiresDeviceType || last.deviceType;

    const isAccessories = isAccessoriesCategory(last.category);
    const hasMakeModel = isAccessories ? true : (!!last.make.trim() && !!last.model.trim());

    if (!last.category.trim() || !last.quantity || last.quantity < 1 || !hasDeviceType || !hasMakeModel) {
      const errorMsg = isAccessories
        ? "Category and quantity are required."
        : (requiresDeviceType
            ? "Category, make, model, quantity and device type are required."
            : "Category, make, model and quantity are required.");
      toast.error("Please complete the current device details before adding another.", {
        description: errorMsg,
      });
      return;
    }
    setCurrentDevices([...currentDevices, { make: "", model: "", category: "", quantity: 1, deviceType: 'Windows' }]);
  };

  const removeCurrentDevice = (index: number) => {
    if (currentDevices.length > 1) {
      setCurrentDevices(currentDevices.filter((_, i) => i !== index));
    }
  };

  // Helper function to auto-assign device type based on make/model
  const inferDeviceType = (make: string, model: string): 'Windows' | 'Apple' | null => {
    const makeLower = make.toLowerCase().trim();
    const modelLower = model.toLowerCase().trim();
    
    // Apple devices
    if (makeLower.includes('apple') || modelLower.includes('mac') || modelLower.includes('iphone') || modelLower.includes('ipad')) {
      return 'Apple';
    }
    
    // Windows devices (common manufacturers)
    const windowsMakes = ['dell', 'hp', 'lenovo', 'microsoft', 'acer', 'asus', 'toshiba', 'samsung', 'lg'];
    if (windowsMakes.some(wm => makeLower.includes(wm))) {
      return 'Windows';
    }
    
    // If make/model are provided but can't be inferred, return null (user must select)
    if (make.trim() && model.trim()) {
      return null; // Can't infer, user must select
    }
    
    return null;
  };

  const updateCurrentDevice = (index: number, field: keyof CurrentDevice, value: string | number) => {
    setCurrentDevices((prev) => {
      const updated = [...prev];
      const device = updated[index];
      if (!device) return prev;
      
      // If updating make or model, try to auto-assign device type
      if (field === 'make' || field === 'model') {
        const newMake = field === 'make' ? (value as string) : device.make;
        const newModel = field === 'model' ? (value as string) : device.model;
        const inferredType = inferDeviceType(newMake, newModel);
        
        updated[index] = { 
          ...device, 
          [field]: value,
          // Auto-assign device type if it can be inferred, but only if category requires it
          ...((device.category.toLowerCase().includes('laptop') || device.category.toLowerCase().includes('desktop')) && inferredType
            ? { deviceType: inferredType }
            : {})
        };
      } else {
        updated[index] = { ...device, [field]: value };
      }
      
      return updated;
    });
  };

  const validateStep1 = (): string | null => {
    if ((isAdmin || isReseller) && !selectedClientId) return "Client selection is required";
    if (!email.trim()) return "Email address is required";
    if (!phone.trim()) return "Phone number is required";
    if (!moveDate) return "Move date is required";

    // Validate current address (for new sites)
    if (selectedCurrentSiteId === 'new') {
      if (!currentAddressDetails.siteName?.trim()) return "Current address site name is required";
      if (!currentAddressDetails.street?.trim()) return "Current address street is required";
      if (!currentAddressDetails.city?.trim()) return "Current address city is required";
      if (!currentAddressDetails.postcode?.trim()) return "Current address postcode is required";
    }

    // Validate new address (for new sites)
    if (selectedNewSiteId === 'new') {
      if (!newAddressDetails.siteName?.trim()) return "New address site name is required";
      if (!newAddressDetails.street?.trim()) return "New address street is required";
      if (!newAddressDetails.city?.trim()) return "New address city is required";
      if (!newAddressDetails.postcode?.trim()) return "New address postcode is required";
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return "Please enter a valid email address";
    }

    return null;
  };

  const validateStep2 = (): string | null => {
    if (currentDevices.length === 0) {
      return "At least one current device is required";
    }

    for (let i = 0; i < currentDevices.length; i++) {
      const device = currentDevices[i];
      if (!device.category.trim()) return `Device ${i + 1}: Category is required`;
      if (!isAccessoriesCategory(device.category)) {
        if (!device.make.trim()) return `Device ${i + 1}: Make is required`;
        if (!device.model.trim()) return `Device ${i + 1}: Model is required`;
      }
      if (!device.quantity || device.quantity < 1) return `Device ${i + 1}: Quantity must be at least 1`;
      // Only require device type if it should be shown for this category
      if (shouldShowDeviceType(device.category) && !device.deviceType) {
        return `Device ${i + 1}: Device type is required`;
      }
    }

    return null;
  };

  const validateForm = (): string | null => {
    const step1Error = validateStep1();
    if (step1Error) return step1Error;
    const step2Error = validateStep2();
    if (step2Error) return step2Error;
    return null;
  };

  const handleNext = () => {
    const error = validateStep1();
    if (error) {
      toast.error("Validation Error", { description: error });
      return;
    }
    setStep(2);
  };

  const handleSubmit = async () => {
    const error = validateForm();
    if (error) {
      toast.error("Validation Error", {
        description: error,
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Resolve client and employee name based on role
      let clientId: string | undefined;
      let clientName: string | undefined;
      let resolvedEmployeeName: string;

      // Build new address from structured fields (used for creating new sites)
      const newFullAddress = [
        newAddressDetails.street?.trim() || "",
        newAddressDetails.city?.trim() || "",
        newAddressDetails.county?.trim() || "",
        newAddressDetails.country?.trim() || ""
      ].filter(Boolean).join(", ");

      if (isAdmin || isReseller) {
        if (!selectedClientId) {
          toast.error("Validation Error", { description: "Client selection is required." });
          setIsSubmitting(false);
          return;
        }
        clientId = selectedClientId;
        const selectedClient = clients.find((c) => c.id === selectedClientId);
        clientName = selectedClient?.organisationName || selectedClient?.name || "Client";
        resolvedEmployeeName = clientName;

        // Save new sites automatically when using new addresses
        if (selectedCurrentSiteId === "new") {
          // Build current address from structured fields for new site creation
          const currentFullAddressForSite = [
            currentAddressDetails.street?.trim() || "",
            currentAddressDetails.city?.trim() || "",
            currentAddressDetails.county?.trim() || "",
            currentAddressDetails.country?.trim() || ""
          ].filter(Boolean).join(", ");
          
          try {
            await createSite.mutateAsync({
              name: currentAddressDetails.siteName,
              address: currentFullAddressForSite,
              postcode: currentAddressDetails.postcode,
              lat: currentLocation?.lat,
              lng: currentLocation?.lng,
              clientId,
            });
          } catch (error) {
            toast.error("Failed to save current site", {
              description: error instanceof Error ? error.message : "Please try again.",
            });
            setIsSubmitting(false);
            return;
          }
        }

        if (selectedNewSiteId === "new") {
          try {
            await createSite.mutateAsync({
              name: newAddressDetails.siteName,
              address: newFullAddress,
              postcode: newAddressDetails.postcode,
              lat: newLocation?.lat,
              lng: newLocation?.lng,
              clientId,
            });
          } catch (error) {
            toast.error("Failed to save new site", {
              description: error instanceof Error ? error.message : "Please try again.",
            });
            setIsSubmitting(false);
            return;
          }
        } else {
          // Existing new site selected - use its address
          const selectedSite = sites.find((s) => s.id === selectedNewSiteId);
          if (selectedSite) {
            const bookingAddress = selectedSite.address;
            const bookingPostcode = selectedSite.postcode || "";
            const bookingLat = selectedSite.lat;
            const bookingLng = selectedSite.lng;

            // Get current address - either from selected site or structured fields
            let currentFullAddress: string;
            let currentPostcode: string;
            let currentLat: number | undefined;
            let currentLng: number | undefined;

            if (selectedCurrentSiteId !== "new") {
              const selectedCurrentSite = sites.find((s) => s.id === selectedCurrentSiteId);
              if (selectedCurrentSite) {
                currentFullAddress = selectedCurrentSite.address;
                currentPostcode = selectedCurrentSite.postcode || "";
                currentLat = selectedCurrentSite.lat;
                currentLng = selectedCurrentSite.lng;
              } else {
                // Fallback to structured fields if site not found
                currentFullAddress = currentFullAddress || [
                  currentAddressDetails.street?.trim() || "",
                  currentAddressDetails.city?.trim() || "",
                  currentAddressDetails.county?.trim() || "",
                  currentAddressDetails.country?.trim() || ""
                ].filter(Boolean).join(", ");
                currentPostcode = currentAddressDetails.postcode;
                currentLat = currentLocation?.lat;
                currentLng = currentLocation?.lng;
              }
            } else {
              // Build current address from structured fields
              currentFullAddress = [
                currentAddressDetails.street?.trim() || "",
                currentAddressDetails.city?.trim() || "",
                currentAddressDetails.county?.trim() || "",
                currentAddressDetails.country?.trim() || ""
              ].filter(Boolean).join(", ");
              currentPostcode = currentAddressDetails.postcode;
              currentLat = currentLocation?.lat;
              currentLng = currentLocation?.lng;
            }

            // Get selected sites for site names
            const selectedNewSite = selectedNewSiteId !== "new" ? sites.find((s) => s.id === selectedNewSiteId) : null;
            const selectedCurrentSite = selectedCurrentSiteId !== "new" ? sites.find((s) => s.id === selectedCurrentSiteId) : null;

            const booking = await jmlBookingService.createMover({
              clientId,
              clientName,
              employeeName: resolvedEmployeeName,
              email,
              address: bookingAddress,
              postcode: bookingPostcode,
              phone,
              siteName: selectedNewSite ? selectedNewSite.name : newAddressDetails.siteName,
              scheduledDate: moveDate!.toISOString(),
              currentAddress: currentFullAddress,
              currentPostcode,
              currentSiteName: selectedCurrentSite ? selectedCurrentSite.name : currentAddressDetails.siteName,
              currentLat,
              currentLng,
              currentDevices: currentDevices
                .filter(d => d.category && d.quantity >= 1)
                .map(d => ({ ...d, deviceType: d.deviceType || inferDeviceTypeFromJmlCategory(d.category) }))
                .filter(d => isAccessoriesCategory(d.category) ? true : (!!d.make && !!d.model)),
              lat: bookingLat,
              lng: bookingLng,
            });

            toast.success("Booking created successfully!", {
              description: `Mover booking ${booking.bookingNumber} has been created.`,
            });

            navigate('/booking');
            return;
          }
        }
      } else if (isClient) {
        resolvedEmployeeName =
          clientProfile?.organisationName ||
          clientProfile?.name ||
          user?.tenantName ||
          "Client";
        
        // For client role, if "new" addresses are selected, save them automatically
        if (selectedCurrentSiteId === "new") {
          try {
            await createSite.mutateAsync({
              name: currentAddressDetails.siteName,
              address: [
                currentAddressDetails.street?.trim() || "",
                currentAddressDetails.city?.trim() || "",
                currentAddressDetails.county?.trim() || "",
                currentAddressDetails.country?.trim() || ""
              ].filter(Boolean).join(", "),
              postcode: currentAddressDetails.postcode,
              lat: currentLocation?.lat,
              lng: currentLocation?.lng,
              clientId: clientProfile?.id, // Use client's own ID
            });
          } catch (error) {
            toast.error("Failed to save current site", {
              description: error instanceof Error ? error.message : "Please try again.",
            });
            setIsSubmitting(false);
            return;
          }
        }
        
        if (selectedNewSiteId === "new") {
          try {
            await createSite.mutateAsync({
              name: newAddressDetails.siteName,
              address: [
                newAddressDetails.street?.trim() || "",
                newAddressDetails.city?.trim() || "",
                newAddressDetails.county?.trim() || "",
                newAddressDetails.country?.trim() || ""
              ].filter(Boolean).join(", "),
              postcode: newAddressDetails.postcode,
              lat: newLocation?.lat,
              lng: newLocation?.lng,
              clientId: clientProfile?.id, // Use client's own ID
            });
          } catch (error) {
            toast.error("Failed to save new site", {
              description: error instanceof Error ? error.message : "Please try again.",
            });
            setIsSubmitting(false);
            return;
          }
        }
      } else {
        resolvedEmployeeName = user?.name || "User";
      }

      // Get current address - either from selected site or structured fields
      let currentFullAddress: string;
      let currentPostcode: string;
      let currentLat: number | undefined;
      let currentLng: number | undefined;

      if (selectedCurrentSiteId !== "new") {
        const selectedCurrentSite = sites.find((s) => s.id === selectedCurrentSiteId);
        if (selectedCurrentSite) {
          currentFullAddress = selectedCurrentSite.address;
          currentPostcode = selectedCurrentSite.postcode || "";
          currentLat = selectedCurrentSite.lat;
          currentLng = selectedCurrentSite.lng;
        } else {
          // Fallback to structured fields if site not found
          currentFullAddress = [
            currentAddressDetails.street?.trim() || "",
            currentAddressDetails.city?.trim() || "",
            currentAddressDetails.county?.trim() || "",
            currentAddressDetails.country?.trim() || ""
          ].filter(Boolean).join(", ");
          currentPostcode = currentAddressDetails.postcode;
          currentLat = currentLocation?.lat;
          currentLng = currentLocation?.lng;
        }
      } else {
        // Build current address from structured fields
        currentFullAddress = [
          currentAddressDetails.street?.trim() || "",
          currentAddressDetails.city?.trim() || "",
          currentAddressDetails.county?.trim() || "",
          currentAddressDetails.country?.trim() || ""
        ].filter(Boolean).join(", ");
        currentPostcode = currentAddressDetails.postcode;
        currentLat = currentLocation?.lat;
        currentLng = currentLocation?.lng;
      }

      // Use new address as the primary address (where they're moving to)
      // Include current address for distance calculation
      const booking = await jmlBookingService.createMover({
        clientId,
        clientName,
        employeeName: resolvedEmployeeName,
        email,
        address: newFullAddress,
        postcode: newAddressDetails.postcode,
        phone,
        siteName: newAddressDetails.siteName,
        scheduledDate: moveDate!.toISOString(),
        currentAddress: currentFullAddress,
        currentPostcode,
        currentSiteName: currentAddressDetails.siteName,
        currentLat,
        currentLng,
        currentDevices: currentDevices
          .filter(d => d.category && d.quantity >= 1)
          .map(d => ({ ...d, deviceType: d.deviceType || inferDeviceTypeFromJmlCategory(d.category) }))
          .filter(d => isAccessoriesCategory(d.category) ? true : (!!d.make && !!d.model)),
        lat: newLocation?.lat,
        lng: newLocation?.lng,
      });

      toast.success("Booking created successfully!", {
        description: `Mover booking ${booking.bookingNumber} has been created.`,
      });

      navigate('/booking');
    } catch (error) {
      toast.error("Failed to create booking", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isBlocked = (isReseller || isAdmin) && !isLoadingClients && clients.length === 0 && !clientsError;

  const canProceed = () => {
    if (step === 1) {
      return validateStep1() === null;
    }
    if (step === 2) {
      return validateStep2() === null;
    }
    return true;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/booking')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Mover Booking</h1>
          <p className="text-muted-foreground">
            Handle device transfer when an employee moves to a different department
          </p>
        </div>
      </div>

      {/* Notification for no clients */}
      {isBlocked && (
        <Alert className="bg-destructive/10 border-destructive/20">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <AlertDescription className="flex items-center justify-between">
            <div>
              <strong className="text-destructive">Cannot Create Booking</strong>
              <p className="text-sm text-muted-foreground mt-1">
                You must add or invite at least one active client before creating bookings.
              </p>
            </div>
            <Button 
              variant="default" 
              size="sm"
              onClick={() => navigate('/clients')}
              className="ml-4"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Add Clients
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Progress Steps */}
      <div className="flex items-center justify-center">
        {steps.map((stepItem, index) => (
          <div key={stepItem.id} className="flex items-center">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: index * 0.1 }}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full transition-all",
                step >= stepItem.id
                  ? "bg-success/70"
                  : "bg-secondary text-muted-foreground"
              )}
            >
              <stepItem.icon className="h-4 w-4" />
              <span className="font-medium hidden sm:inline">{stepItem.title}</span>
              <span className="font-medium sm:hidden">{stepItem.id}</span>
            </motion.div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "w-12 h-0.5 mx-2",
                  step > stepItem.id ? "bg-success" : "bg-border"
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className={cn("relative", isBlocked && "opacity-50")}>
        <AnimatePresence mode="wait">
          {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
          <div className={cn("space-y-6", isBlocked && "opacity-50 pointer-events-none")}>
            {/* Employee Details Card */}
            <Card>
              <CardHeader>
                <CardTitle>Employee Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Client Selection for Admin/Reseller */}
                {(isAdmin || isReseller) && (
                  <div className="space-y-2 p-3 bg-muted/50 rounded-lg border">
                    <Label className="text-sm font-semibold">
                      Client Selection {clients.length > 0 ? '*' : '(optional - will create new client)'}
                    </Label>
                    {isLoadingClients ? (
                      <div className="flex items-center justify-center py-2">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : clientsError ? (
                      <div className="text-sm text-muted-foreground p-2">
                        Unable to load clients. A new client will be created when you submit.
                      </div>
                    ) : (
                      <Select
                        value={selectedClientId}
                        onValueChange={setSelectedClientId}
                      >
                        <SelectTrigger className="bg-background h-9">
                          <SelectValue placeholder="Select a client" />
                        </SelectTrigger>
                        <SelectContent>
                          {clients.length === 0 ? (
                            <div className="px-2 py-1.5 text-sm text-muted-foreground">
                              No clients available - a new client will be created
                            </div>
                          ) : (
                            clients.map((client) => (
                              <SelectItem key={client.id} value={client.id}>
                                <div className="flex items-center gap-2">
                                  <Building2 className="h-4 w-4" />
                                    <span>
                                      {client.organisationName || client.name}
                                      {client.name && client.organisationName && client.name !== client.organisationName
                                        ? ` (${client.name})`
                                        : ''}
                                    </span>
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-sm">
                      Email Address *
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          setHasTouchedEmailPhone(true);
                        }}
                      placeholder="john.doe@example.com"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-sm">
                      Phone Number *
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={phone}
                        onChange={(e) => {
                          setPhone(e.target.value);
                          setHasTouchedEmailPhone(true);
                        }}
                      placeholder="+44 123 456 7890"
                      className="h-9"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">
                    Move Date *
                  </Label>
                  <DatePicker
                    date={moveDate}
                    onDateChange={setMoveDate}
                    placeholder="Select move date"
                    minDate={isAdmin ? undefined : new Date()}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Current Address Card */}
            <Card>
              <CardHeader>
                <CardTitle>Current Address (Collection)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Current Address Site Selection */}
                <div className="space-y-2 p-3 bg-muted/50 rounded-lg border">
                  <Label className="text-sm font-semibold">
                    Collection Address {selectedCurrentSiteId === 'new' ? '*' : ''}
                  </Label>
                  {isLoadingSites ? (
                    <div className="flex items-center justify-center py-2">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <Select
                      value={selectedCurrentSiteId}
                      onValueChange={handleCurrentSiteSelect}
                    >
                      <SelectTrigger className="bg-background h-9">
                        <SelectPrimitive.Value asChild>
                          <span className="truncate block text-left flex-1">
                            {selectedCurrentSiteId === 'new' 
                              ? 'New Address' 
                              : (() => {
                                  const selectedSite = sites.find(s => s.id === selectedCurrentSiteId);
                                  return selectedSite ? selectedSite.name : 'Select a site or create new';
                                })()
                            }
                          </span>
                        </SelectPrimitive.Value>
                      </SelectTrigger>
                      <SelectContent className="max-w-[var(--radix-select-trigger-width)]">
                        <SelectItem value="new">
                          <div className="flex items-center gap-2">
                            <Plus className="h-4 w-4 flex-shrink-0" />
                            <span>New Address</span>
                          </div>
                        </SelectItem>
                        {sites.length > 0 && sites.map((site) => {
                          const addressParts = site.address.split(',').map(s => s.trim());
                          const addressLine1 = addressParts.slice(0, Math.ceil(addressParts.length / 2)).join(', ');
                          const addressLine2 = addressParts.slice(Math.ceil(addressParts.length / 2)).join(', ');
                          
                          return (
                            <SelectItem key={site.id} value={site.id} textValue={site.name}>
                              <div className="flex flex-col min-w-0 text-left">
                                <span className="font-medium">{site.name}</span>
                                <div className="flex flex-col mt-0.5">
                                  {addressLine2 ? (
                                    <>
                                      <span className="text-xs text-muted-foreground leading-relaxed">
                                        {addressLine1}
                                      </span>
                                      <span className="text-xs text-muted-foreground leading-relaxed">
                                        {addressLine2}, {site.postcode}
                                      </span>
                                    </>
                                  ) : (
                                    <span className="text-xs text-muted-foreground leading-relaxed">
                                      {site.address}, {site.postcode}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Current Address Site Name (for new sites) */}
                {selectedCurrentSiteId === 'new' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="current-siteName" className="text-sm">Site Name *</Label>
                    <Input
                      id="current-siteName"
                      placeholder="e.g., Main Office, Warehouse, etc."
                      value={currentAddressDetails.siteName}
                      onChange={(e) =>
                        setCurrentAddressDetails({ ...currentAddressDetails, siteName: e.target.value })
                      }
                      className="h-9"
                    />
                  </div>
                )}

                <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="current-street" className="text-sm">Street *</Label>
                      <Input
                        id="current-street"
                        placeholder="123 High Street"
                        value={currentAddressDetails.street}
                        onChange={(e) =>
                          setCurrentAddressDetails({ ...currentAddressDetails, street: e.target.value })
                        }
                        disabled={(isAdmin || isReseller) && selectedCurrentSiteId !== 'new'}
                        className="h-9"
                      />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="current-city" className="text-sm">City *</Label>
                        <Input
                          id="current-city"
                          placeholder="London"
                          value={currentAddressDetails.city}
                          onChange={(e) =>
                            setCurrentAddressDetails({ ...currentAddressDetails, city: e.target.value })
                          }
                          disabled={(isAdmin || isReseller) && selectedCurrentSiteId !== 'new'}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="current-county" className="text-sm">County</Label>
                        <Input
                          id="current-county"
                          placeholder="Greater London"
                          value={currentAddressDetails.county}
                          onChange={(e) =>
                            setCurrentAddressDetails({ ...currentAddressDetails, county: e.target.value })
                          }
                          disabled={(isAdmin || isReseller) && selectedCurrentSiteId !== 'new'}
                          className="h-9"
                        />
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="current-postcode" className="text-sm">Postcode *</Label>
                        <Input
                          id="current-postcode"
                          placeholder="EC1A 1BB"
                          value={currentAddressDetails.postcode}
                          onChange={(e) =>
                            setCurrentAddressDetails({ ...currentAddressDetails, postcode: e.target.value })
                          }
                          disabled={(isAdmin || isReseller) && selectedCurrentSiteId !== 'new'}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="current-country" className="text-sm">Country</Label>
                        <Input
                          id="current-country"
                          value={currentAddressDetails.country}
                          onChange={(e) =>
                            setCurrentAddressDetails({ ...currentAddressDetails, country: e.target.value })
                          }
                          disabled={(isAdmin || isReseller) && selectedCurrentSiteId !== 'new'}
                          className="h-9"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Map for Current Address */}
                <div className="mt-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <MapPin className="h-4 w-4" />
                        Current Address Map
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <MapPicker
                        position={currentLocation}
                        onPositionChange={(position) => {
                          setCurrentLocation(position);
                          // If user selects a location on map while an existing site is selected, switch to 'new' mode
                          if (selectedCurrentSiteId !== 'new') {
                            setSelectedCurrentSiteId('new');
                            // Reset address details when switching to new address
                            setCurrentAddressDetails({
                              siteName: "",
                              street: "",
                              city: "",
                              county: "",
                              postcode: "",
                              country: "",
                            });
                          }
                        }}
                        onAddressDetailsChange={(details) => {
                          // If user clicks on map while an existing site is selected, switch to 'new' mode
                          if (selectedCurrentSiteId !== 'new') {
                            setSelectedCurrentSiteId('new');
                            // Reset address details when switching to new address
                            setCurrentAddressDetails({
                              siteName: "",
                              street: "",
                              city: "",
                              county: "",
                              postcode: "",
                              country: "",
                            });
                          }
                          // Update address fields when creating new site
                          setCurrentAddressDetails(prev => ({
                            ...prev,
                            street: details.street !== undefined ? details.street : prev.street,
                            city: details.city !== undefined ? details.city : prev.city,
                            county: details.county !== undefined ? details.county : prev.county,
                            postcode: details.postcode !== undefined ? details.postcode : prev.postcode,
                            country: details.country !== undefined ? details.country : prev.country,
                          }));
                        }}
                        height="300px"
                      />
                      {isGeocodingCurrentAddress && (
                        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Geocoding address...
                        </p>
                      )}
                      {currentLocation && !isGeocodingCurrentAddress && (
                        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          Location set at {currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>

            {/* New Address Card */}
            <Card>
              <CardHeader>
                <CardTitle>New Address (Delivery)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* New Address Site Selection */}
                <div className="space-y-2 p-3 bg-muted/50 rounded-lg border">
                  <Label className="text-sm font-semibold">
                    Delivery Address {selectedNewSiteId === 'new' ? '*' : ''}
                  </Label>
                  {isLoadingSites ? (
                    <div className="flex items-center justify-center py-2">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <Select
                      value={selectedNewSiteId}
                      onValueChange={handleNewSiteSelect}
                    >
                      <SelectTrigger className="bg-background h-9">
                        <SelectPrimitive.Value asChild>
                          <span className="truncate block text-left flex-1">
                            {selectedNewSiteId === 'new' 
                              ? 'New Address' 
                              : (() => {
                                  const selectedSite = sites.find(s => s.id === selectedNewSiteId);
                                  return selectedSite ? selectedSite.name : 'Select a site or create new';
                                })()
                            }
                          </span>
                        </SelectPrimitive.Value>
                      </SelectTrigger>
                      <SelectContent className="max-w-[var(--radix-select-trigger-width)]">
                        <SelectItem value="new">
                          <div className="flex items-center gap-2">
                            <Plus className="h-4 w-4 flex-shrink-0" />
                            <span>New Address</span>
                          </div>
                        </SelectItem>
                        {sites.length > 0 && sites.map((site) => {
                          const addressParts = site.address.split(',').map(s => s.trim());
                          const addressLine1 = addressParts.slice(0, Math.ceil(addressParts.length / 2)).join(', ');
                          const addressLine2 = addressParts.slice(Math.ceil(addressParts.length / 2)).join(', ');
                          
                          return (
                            <SelectItem key={site.id} value={site.id} textValue={site.name}>
                              <div className="flex flex-col min-w-0 text-left">
                                <span className="font-medium">{site.name}</span>
                                <div className="flex flex-col mt-0.5">
                                  {addressLine2 ? (
                                    <>
                                      <span className="text-xs text-muted-foreground leading-relaxed">
                                        {addressLine1}
                                      </span>
                                      <span className="text-xs text-muted-foreground leading-relaxed">
                                        {addressLine2}, {site.postcode}
                                      </span>
                                    </>
                                  ) : (
                                    <span className="text-xs text-muted-foreground leading-relaxed">
                                      {site.address}, {site.postcode}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* New Address Site Name (for new sites) */}
                {selectedNewSiteId === 'new' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="new-siteName" className="text-sm">Site Name *</Label>
                    <Input
                      id="new-siteName"
                      placeholder="e.g., New Office, Branch Location, etc."
                      value={newAddressDetails.siteName}
                      onChange={(e) =>
                        setNewAddressDetails({ ...newAddressDetails, siteName: e.target.value })
                      }
                      className="h-9"
                    />
                  </div>
                )}

                <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="new-street" className="text-sm">Street *</Label>
                      <Input
                        id="new-street"
                        placeholder="123 High Street"
                        value={newAddressDetails.street}
                        onChange={(e) =>
                          setNewAddressDetails({ ...newAddressDetails, street: e.target.value })
                        }
                        disabled={(isAdmin || isReseller) && selectedNewSiteId !== 'new'}
                        className="h-9"
                      />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="new-city" className="text-sm">City *</Label>
                        <Input
                          id="new-city"
                          placeholder="London"
                          value={newAddressDetails.city}
                          onChange={(e) =>
                            setNewAddressDetails({ ...newAddressDetails, city: e.target.value })
                          }
                          disabled={(isAdmin || isReseller) && selectedNewSiteId !== 'new'}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="new-county" className="text-sm">County</Label>
                        <Input
                          id="new-county"
                          placeholder="Greater London"
                          value={newAddressDetails.county}
                          onChange={(e) =>
                            setNewAddressDetails({ ...newAddressDetails, county: e.target.value })
                          }
                          disabled={(isAdmin || isReseller) && selectedNewSiteId !== 'new'}
                          className="h-9"
                        />
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="new-postcode" className="text-sm">Postcode *</Label>
                        <Input
                          id="new-postcode"
                          placeholder="EC1A 1BB"
                          value={newAddressDetails.postcode}
                          onChange={(e) =>
                            setNewAddressDetails({ ...newAddressDetails, postcode: e.target.value })
                          }
                          disabled={(isAdmin || isReseller) && selectedNewSiteId !== 'new'}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="new-country" className="text-sm">Country</Label>
                        <Input
                          id="new-country"
                          value={newAddressDetails.country}
                          onChange={(e) =>
                            setNewAddressDetails({ ...newAddressDetails, country: e.target.value })
                          }
                          disabled={(isAdmin || isReseller) && selectedNewSiteId !== 'new'}
                          className="h-9"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Map for New Address */}
                <div className="mt-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <MapPin className="h-4 w-4" />
                        New Address Map
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <MapPicker
                        position={newLocation}
                        onPositionChange={(position) => {
                          setNewLocation(position);
                          // If user selects a location on map while an existing site is selected, switch to 'new' mode
                          if (selectedNewSiteId !== 'new') {
                            setSelectedNewSiteId('new');
                            // Reset address details when switching to new address
                            setNewAddressDetails({
                              siteName: "",
                              street: "",
                              city: "",
                              county: "",
                              postcode: "",
                              country: "",
                            });
                          }
                        }}
                        onAddressDetailsChange={(details) => {
                          // If user clicks on map while an existing site is selected, switch to 'new' mode
                          if (selectedNewSiteId !== 'new') {
                            setSelectedNewSiteId('new');
                            // Reset address details when switching to new address
                            setNewAddressDetails({
                              siteName: "",
                              street: "",
                              city: "",
                              county: "",
                              postcode: "",
                              country: "",
                            });
                          }
                          // Update address fields when creating new site
                          setNewAddressDetails(prev => ({
                            ...prev,
                            street: details.street !== undefined ? details.street : prev.street,
                            city: details.city !== undefined ? details.city : prev.city,
                            county: details.county !== undefined ? details.county : prev.county,
                            postcode: details.postcode !== undefined ? details.postcode : prev.postcode,
                            country: details.country !== undefined ? details.country : prev.country,
                          }));
                        }}
                        height="300px"
                      />
                      {isGeocodingNewAddress && (
                        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Geocoding address...
                        </p>
                      )}
                      {newLocation && !isGeocodingNewAddress && (
                        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          Location set at {newLocation.lat.toFixed(4)}, {newLocation.lng.toFixed(4)}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>

          </div>
          </motion.div>
        )}

          {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className={cn(isBlocked && "opacity-50 pointer-events-none")}
          >
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Current Devices</CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addCurrentDevice}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Device
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {currentDevices.map((device, index) => (
                <Card key={index} className="border-2">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-semibold">Device {index + 1}</Label>
                      {currentDevices.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeCurrentDevice(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="space-y-2">
                          <Label>
                            Category <span className="text-destructive">*</span>
                          </Label>
                          <Select value={device.category} onValueChange={(value) => {
                            updateCurrentDevice(index, 'category', value);
                            updateCurrentDevice(index, 'deviceType', inferDeviceTypeFromJmlCategory(value));
                            // Auto-assign device type if make/model are already set
                            const device = currentDevices[index];
                            if (device.make.trim() && device.model.trim()) {
                              const inferredType = inferDeviceType(device.make, device.model);
                              if ((value.toLowerCase().includes('laptop') || value.toLowerCase().includes('desktop')) && inferredType) {
                                updateCurrentDevice(index, 'deviceType', inferredType);
                              }
                            }
                          }}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              {jmlAssetCategories.map((category) => (
                                <SelectItem key={category.id} value={category.name}>
                                  {category.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {!isAccessoriesCategory(device.category) ? (
                          <>
                            <div className="space-y-2">
                              <Label>
                                Device Make <span className="text-destructive">*</span>
                              </Label>
                              <Input
                                value={device.make}
                                onChange={(e) => updateCurrentDevice(index, 'make', e.target.value)}
                                placeholder="Dell, HP, Lenovo, etc."
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>
                                Device Model <span className="text-destructive">*</span>
                              </Label>
                              <Input
                                value={device.model}
                                onChange={(e) => updateCurrentDevice(index, 'model', e.target.value)}
                                placeholder="Latitude 7420, ThinkPad X1, etc."
                              />
                            </div>
                          </>
                        ) : (
                          <div className="md:col-span-2 space-y-2">
                            <Label>Accessories Notes</Label>
                            <Textarea
                              value={device.notes || ""}
                              onChange={(e) => updateCurrentDevice(index, "notes", e.target.value)}
                              placeholder="e.g., charger, dock, keyboard, mouse, monitor cable..."
                              className="min-h-[92px]"
                            />
                          </div>
                        )}
                      </div>
                      <div className="flex gap-3 items-end">
                        <div className="space-y-2 w-24">
                          <Label>
                            Quantity <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            type="number"
                            min="1"
                            value={device.quantity}
                            onChange={(e) => updateCurrentDevice(index, 'quantity', parseInt(e.target.value) || 1)}
                            placeholder="1"
                          />
                        </div>
                        {shouldShowDeviceType(device.category) && (
                          <div className="space-y-2 flex-1">
                            <Label>
                              Device Type <span className="text-destructive">*</span>
                            </Label>
                            <RadioGroup
                              value={device.deviceType || inferDeviceTypeFromJmlCategory(device.category)}
                              onValueChange={(value) => updateCurrentDevice(index, 'deviceType', value as JmlDeviceType)}
                            >
                              {getDeviceTypeOptionsForJmlCategory(device.category).map((opt) => {
                                const optId = `${opt.toLowerCase()}-${index}`;
                                return (
                                  <div key={opt} className="flex items-center space-x-2">
                                    <RadioGroupItem value={opt} id={optId} />
                                    <Label htmlFor={optId} className="cursor-pointer">{opt}</Label>
                                  </div>
                                );
                              })}
                            </RadioGroup>
                          </div>
                        )}
                      </div>
                </div>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>

          {/* CO2e Preview */}
          {selectedAssetsForCO2.length > 0 && (
            <Card className="mt-6 bg-gradient-eco border-primary/20">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Leaf className="h-4 w-4 text-primary" />
                  Environmental Impact Preview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center">
                  <div className="min-w-0 overflow-hidden">
                    <p className="text-lg sm:text-2xl font-bold text-success break-words overflow-hidden leading-tight">
                      {co2eSaved >= 1000
                        ? `${(co2eSaved / 1000).toFixed(1)}t`
                        : `${co2eSaved.toFixed(1)}kg`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">CO₂e Saved</p>
                  </div>

                  <div className="min-w-0 overflow-hidden">
                    <p
                      className="text-lg sm:text-2xl font-bold text-destructive break-words overflow-hidden leading-tight"
                    >
                      {travelEmissions === 0 ? "0kg" : `-${travelEmissions.toFixed(1)}kg`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 break-words">
                      Travel Emissions (Petrol)
                    </p>
                  </div>

                  <div className={cn("min-w-0 overflow-hidden", netCO2e > 0 && "relative")}>
                    <p
                      className={cn(
                        "text-lg sm:text-3xl font-bold transition-colors break-words overflow-hidden leading-tight",
                        netCO2e > 0
                          ? "text-success"
                          : netCO2e < 0
                            ? "text-destructive"
                            : "text-primary"
                      )}
                    >
                      {netCO2e > 0 && "+"}
                      {Math.abs(netCO2e) >= 1000
                        ? `${(netCO2e / 1000).toFixed(1)}t`
                        : `${netCO2e.toFixed(1)}kg`}
                    </p>
                    <p
                      className={cn(
                        "text-xs font-medium mt-1",
                        netCO2e > 0 ? "text-success/80" : "text-muted-foreground"
                      )}
                    >
                      Net Benefit
                      {netCO2e > 0 && " ✓"}
                    </p>
                  </div>
                </div>

                {(isFetchingCO2 || isCalculatingMoverDistance) && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Calculating CO2e...
                  </div>
                )}

                <p
                  className={cn(
                    "text-sm text-center font-medium",
                    netCO2e > 0 ? "text-success" : "text-muted-foreground"
                  )}
                >
                  {netCO2e > 0 && "✓ "}
                  ≈ {co2eEquivalencies.treesPlanted(netCO2e)} trees planted equivalent
                  {netCO2e > 0 && " - Great environmental impact!"}
                </p>

                <p
                  className={cn(
                    "text-sm text-center font-medium mt-2",
                    co2eSaved > 0 ? "text-success" : "text-muted-foreground"
                  )}
                >
                  {co2eSaved > 0 && "✓ "}
                  ≈ {co2eEquivalencies.treesPlanted(co2eSaved)} trees planted equivalent from CO₂e saved
                </p>
              </CardContent>
            </Card>
          )}
          </motion.div>
        )}

        {step === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            {/* Summary Cards */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Employee Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Email</span>
                    <span className="font-semibold text-foreground">{email}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Phone</span>
                    <span className="font-semibold text-foreground">{phone}</span>
                  </div>
                  {moveDate && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Move Date</span>
                      <span className="font-semibold text-foreground">
                        {moveDate.toLocaleDateString("en-GB", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  )}

                  <div className="pt-3 border-t space-y-3">
                    {/* Collection Site */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Collection Site</span>
                        <span className="font-semibold text-foreground">
                          {currentAddressDetails.siteName ||
                          (selectedCurrentSiteId !== "new"
                            ? sites.find((s) => s.id === selectedCurrentSiteId)?.name
                            : "N/A")}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Address</span>
                        <span className="font-semibold text-foreground text-right max-w-[60%]">
                          {selectedCurrentSiteId === "new"
                            ? `${currentAddressDetails.street}, ${currentAddressDetails.city}, ${currentAddressDetails.postcode}`
                            : sites.find((s) => s.id === selectedCurrentSiteId)?.address || "N/A"}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Postcode</span>
                        <span className="font-semibold text-foreground">
                          {selectedCurrentSiteId === "new"
                            ? currentAddressDetails.postcode
                            : sites.find((s) => s.id === selectedCurrentSiteId)?.postcode || "N/A"}
                        </span>
                      </div>
                    </div>

                    {/* Delivery Site */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Delivery Site</span>
                        <span className="font-semibold text-foreground">
                          {newAddressDetails.siteName ||
                          (selectedNewSiteId !== "new"
                            ? sites.find((s) => s.id === selectedNewSiteId)?.name
                            : "N/A")}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Address</span>
                        <span className="font-semibold text-foreground text-right max-w-[60%]">
                          {selectedNewSiteId === "new"
                            ? `${newAddressDetails.street}, ${newAddressDetails.city}, ${newAddressDetails.postcode}`
                            : sites.find((s) => s.id === selectedNewSiteId)?.address || "N/A"}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Postcode</span>
                        <span className="font-semibold text-foreground">
                          {selectedNewSiteId === "new"
                            ? newAddressDetails.postcode
                            : sites.find((s) => s.id === selectedNewSiteId)?.postcode || "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Device Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Devices</span>
                    <span className="font-semibold text-foreground">
                      {currentDevices.reduce((sum, d) => sum + d.quantity, 0)} units
                    </span>
                  </div>
                  <div className="pt-3 border-t space-y-2">
                    {currentDevices.map((device, index) => {
                      const category = assetCategories.find(c => c.name === device.category);
                      const deviceInfo = isAccessoriesCategory(device.category)
                        ? (device.notes?.trim() || "Accessories")
                        : [
                            device.make,
                            device.model,
                            shouldShowDeviceType(device.category) ? device.deviceType : null
                          ].filter(Boolean).join(' • ');
                      return (
                        <div key={index} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            {category?.icon} {device.category} ({deviceInfo})
                          </span>
                          <span className="font-semibold text-foreground">{device.quantity}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {currentDevices.some((d) => d.category && d.quantity > 0) && (
                <Card className="bg-gradient-eco border-primary/20 md:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Leaf className="h-4 w-4 text-primary" />
                      Impact & Value
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Estimated Buyback</span>
                      <span className="text-xl font-bold text-foreground">£{buybackEstimate.toLocaleString()}</span>
                    </div>
                    <BuybackEstimateDisclaimer />

                    <div className="space-y-3 pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <Leaf className="h-4 w-4 text-primary" />
                        <span className="font-semibold">Environmental Impact Preview</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center">
                        <div className="min-w-0 overflow-hidden">
                          <p className="text-lg sm:text-2xl font-bold text-success break-words overflow-hidden leading-tight">
                            {co2eSaved >= 1000
                              ? `${(co2eSaved / 1000).toFixed(1)}t`
                              : `${co2eSaved.toFixed(1)}kg`}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">CO₂e Saved</p>
                        </div>

                        <div className="min-w-0 overflow-hidden">
                          <p className="text-lg sm:text-2xl font-bold text-destructive break-words overflow-hidden leading-tight">
                            {travelEmissions === 0 ? "0kg" : `-${travelEmissions.toFixed(1)}kg`}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1 break-words">
                            Travel Emissions (Petrol)
                          </p>
                        </div>

                        <div className={cn("min-w-0 overflow-hidden", netCO2e > 0 && "relative")}>
                          <p
                            className={cn(
                              "text-lg sm:text-3xl font-bold transition-colors break-words overflow-hidden leading-tight",
                              netCO2e > 0 ? "text-success" : netCO2e < 0 ? "text-destructive" : "text-primary"
                            )}
                          >
                            {netCO2e > 0 && "+"}
                            {Math.abs(netCO2e) >= 1000
                              ? `${(netCO2e / 1000).toFixed(1)}t`
                              : `${netCO2e.toFixed(1)}kg`}
                          </p>
                          <p
                            className={cn(
                              "text-xs font-medium mt-1",
                              netCO2e > 0 ? "text-success/80" : "text-muted-foreground"
                            )}
                          >
                            Net Benefit
                            {netCO2e > 0 && " ✓"}
                          </p>
                        </div>
                      </div>

                      {(isFetchingCO2 || isCalculatingMoverDistance) && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Calculating CO2e...
                        </div>
                      )}

                      <p
                        className={cn(
                          "text-sm text-center font-medium",
                          netCO2e > 0 ? "text-success" : "text-muted-foreground"
                        )}
                      >
                        {netCO2e > 0 && "✓ "}
                        ≈ {co2eEquivalencies.treesPlanted(netCO2e)} trees planted equivalent
                        {netCO2e > 0 && " - Great environmental impact!"}
                      </p>

                      <p
                        className={cn(
                          "text-sm text-center font-medium mt-2",
                          co2eSaved > 0 ? "text-success" : "text-muted-foreground"
                        )}
                      >
                        {co2eSaved > 0 && "✓ "}
                        ≈ {co2eEquivalencies.treesPlanted(co2eSaved)} trees planted equivalent from CO₂e saved
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
            
          </motion.div>
        )}
      </AnimatePresence>
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => {
            if (step === 1) {
              navigate("/bookings/jml");
              return;
            }
            setStep((s) => (s - 1) as 1 | 2 | 3);
          }}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        {step < 3 ? (
          <Button
            variant="outline"
            onClick={() => {
              if (step === 1) {
                const error = validateStep1();
                if (error) {
                  toast.error("Validation Error", { description: error });
                  return;
                }
                setStep(2);
              } else if (step === 2) {
                const error = validateStep2();
                if (error) {
                  toast.error("Validation Error", { description: error });
                  return;
                }
                setStep(3);
              }
            }}
            disabled={!canProceed() || isBlocked}
          >
            Continue
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button
            variant="default"
            onClick={handleSubmit}
            disabled={isSubmitting || !canProceed() || isBlocked}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin mr-2 h-4 w-4" />
                Submitting...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Submit Booking
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
};

export default JMLMover;
