import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Calendar, MapPin, Phone, User, Laptop, Wrench, ArrowLeft, ArrowRight, Loader2, CheckCircle2, Plus, X, Building2, AlertCircle, UserPlus, Package, Calculator, Heart, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAssetCategories } from "@/hooks/useAssets";
import { useCO2Calculation } from "@/hooks/useCO2";
import { useBuybackCalculation } from "@/hooks/useBuyback";
import { jmlBookingService } from "@/services/jml-booking.service";
import { Mail } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BuybackEstimateDisclaimer } from "@/components/booking/BuybackEstimateDisclaimer";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/auth-context";
import { useClients, useClientProfile } from "@/hooks/useClients";
import { useSites, useCreateSite } from "@/hooks/useSites";
import { geocodeAddressWithDetails } from "@/lib/calculations";
import { validateEuropeanPostcode } from "@/lib/european-validation";
import { MapPicker } from "@/components/booking/MapPicker";
import { cn } from "@/lib/utils";
import { filterJmlAssetCategories, getDeviceTypeOptionsForJmlCategory, getUnderlyingAssetCategoryNameForJml, inferDeviceTypeFromJmlCategory, isAccessoriesCategory, shouldShowDeviceTypeForJmlCategory, type JmlDeviceType } from "@/lib/jml-assets";
import { co2eEquivalencies } from "@/lib/constants";
import { log } from '@/lib/log';

interface BrokenDevice {
  make: string;
  model: string;
  category: string;
  quantity: number;
  deviceType: JmlDeviceType;
  notes?: string;
}

const steps = [
  { id: 1, title: "Employee Details", icon: User },
  { id: 2, title: "Devices", icon: Package },
  { id: 3, title: "Review & Submit", icon: Calculator },
];

const JMLBreakfix = () => {
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
  const [selectedSiteId, setSelectedSiteId] = useState<string>("new");

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
  const [siteLocation, setSiteLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isGeocodingAddress, setIsGeocodingAddress] = useState(false);
  const [brokenDevices, setBrokenDevices] = useState<BrokenDevice[]>([
    { make: "", model: "", category: "", quantity: 1, deviceType: 'Windows' }
  ]);
  const [charityPercent, setCharityPercent] = useState(10);

  // Convert broken devices to asset selection format for CO2/buyback calculations.
  // Accessories-only bookings still need CO2 travel emissions, but buyback should be based on non-accessories.
  const selectedBrokenAssetsForCO2 = useMemo(() => {
    const fallbackCategoryId = assetCategories[0]?.id ?? '';
    const accessoryCategoryId =
      assetCategories.find(c => isAccessoriesCategory(c.name) || c.name.toLowerCase().includes('accessor'))?.id ??
      fallbackCategoryId;

    return brokenDevices
      .filter(d => d.category && d.quantity > 0)
      .map(d => {
        const underlyingName = getUnderlyingAssetCategoryNameForJml(d.category);
        const isAccessoryDevice = isAccessoriesCategory(d.category);

        const category = isAccessoryDevice
          ? assetCategories.find(c => isAccessoriesCategory(c.name) || c.name.toLowerCase().includes('accessor'))
          : underlyingName
            ? assetCategories.find(c => c.name.trim().toLowerCase() === underlyingName.trim().toLowerCase())
            : assetCategories.find(c => c.name.trim().toLowerCase() === d.category.trim().toLowerCase());

        return {
          categoryId: category?.id || (isAccessoryDevice ? accessoryCategoryId : ''),
          quantity: d.quantity,
          isAccessory: isAccessoryDevice,
        };
      })
      .filter(a => a.categoryId);
  }, [brokenDevices, assetCategories]);

  const selectedBrokenAssetsForBuyback = useMemo(() => {
    return brokenDevices
      .filter(d => d.category && d.quantity > 0 && !isAccessoriesCategory(d.category))
      .map(d => {
        const underlyingName = getUnderlyingAssetCategoryNameForJml(d.category);
        const category = underlyingName
          ? assetCategories.find(c => c.name === underlyingName)
          : assetCategories.find(c => c.name === d.category);

        return {
          categoryId: category?.id || '',
          quantity: d.quantity,
        };
      })
      .filter(a => a.categoryId);
  }, [brokenDevices, assetCategories]);

  // Calculate buyback estimate
  const buybackCalculationRequest = useMemo(() => {
    if (selectedBrokenAssetsForBuyback.length === 0) return null;
    return {
      assets: selectedBrokenAssetsForBuyback,
    };
  }, [selectedBrokenAssetsForBuyback]);

  const { data: buybackCalculation } = useBuybackCalculation(buybackCalculationRequest);
  const buybackEstimate = buybackCalculation?.estimatedBuyback ?? 0;
  const buybackTotalPounds = Math.round(buybackEstimate);
  const charityPounds = Math.round(buybackEstimate * (charityPercent / 100));
  const yourReturnPounds = buybackTotalPounds - charityPounds;

  // Estimated collection & processing cost UI is removed.

  const co2CalculationRequest = useMemo(() => {
    if (selectedBrokenAssetsForCO2.length === 0) return null;
    const coordinates = siteLocation || { lat: 51.5074, lng: -0.1278 }; // London fallback (estimated)
    return {
      assets: selectedBrokenAssetsForCO2,
      collectionCoordinates: coordinates,
      vehicleType: "petrol" as const,
    };
  }, [selectedBrokenAssetsForCO2, siteLocation]);

  const { data: co2Calculation, isFetching: isFetchingCO2 } = useCO2Calculation(co2CalculationRequest);

  const co2eSaved = co2Calculation?.reuseSavings ?? 0;
  const travelEmissions = co2Calculation?.travelEmissions ?? 0;
  const netCO2e = co2Calculation?.netImpact ?? 0;

  // Replacement device requirements (what admin allocates from inventory)
  const [replacementDevices, setReplacementDevices] = useState<BrokenDevice[]>([
    { make: "", model: "", category: "", quantity: 1, deviceType: 'Windows' }
  ]);

  // Structured address fields (like ITAD booking)
  const [siteDetails, setSiteDetails] = useState({
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
      setSelectedSiteId("new");
      setHasTouchedEmailPhone(false);
      setSiteDetails({
        siteName: "",
        street: "",
        city: "",
        county: "",
        postcode: "",
        country: "",
      });
      setSiteLocation(null);
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

  // Auto-geocode postcode when manually entered (for new addresses only)
  useEffect(() => {
    if (selectedSiteId !== 'new' || !siteDetails.postcode.trim()) {
      return;
    }

    if (!validateEuropeanPostcode(siteDetails.postcode, siteDetails.country)) {
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsGeocodingAddress(true);
      try {
        const result = await geocodeAddressWithDetails(siteDetails.postcode);
        if (result && result.coordinates) {
          setSiteLocation({ lat: result.coordinates.lat, lng: result.coordinates.lng });
          if (result.address) {
            setSiteDetails(prev => ({
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
        log.error("Geocoding error:", error);
        setSiteLocation(null);
      } finally {
        setIsGeocodingAddress(false);
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [siteDetails.postcode, siteDetails.country, selectedSiteId]);

  // Handle site selection (like ITAD booking)
  const handleSiteSelect = (siteId: string) => {
    setSelectedSiteId(siteId);
    
    if (siteId === 'new') {
      // Reset form for new site
      setSiteDetails({
        siteName: "",
        street: "",
        city: "",
        county: "",
        postcode: "",
        country: "",
      });
      setSiteLocation(null);
    } else {
      // Load selected site details
      const selectedSite = sites.find(s => s.id === siteId);
      if (selectedSite) {
        // Parse address - assume format is "street, city, county, country"
        const addressParts = selectedSite.address.split(',').map(s => s.trim());
        setSiteDetails({
          siteName: selectedSite.name,
          street: addressParts[0] || "",
          city: addressParts[1] || "",
          county: addressParts[2] || "",
          postcode: selectedSite.postcode,
          country: addressParts[3] || "",
        });
        if (selectedSite.lat && selectedSite.lng) {
          setSiteLocation({ lat: selectedSite.lat, lng: selectedSite.lng });
        } else {
          setSiteLocation(null);
        }
      }
    }
  };

  // Helper function to check if Device Type should be shown for a category
  const shouldShowDeviceType = (category: string): boolean => shouldShowDeviceTypeForJmlCategory(category);

  const addBrokenDevice = () => {
    // Validate last device before adding a new one
    const last = brokenDevices[brokenDevices.length - 1];
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
    setBrokenDevices([...brokenDevices, { make: "", model: "", category: "", quantity: 1, deviceType: 'Windows' }]);
  };

  const addReplacementDevice = () => {
    const last = replacementDevices[replacementDevices.length - 1];
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
      toast.error("Please complete the current replacement device details before adding another.", {
        description: errorMsg,
      });
      return;
    }

    setReplacementDevices([
      ...replacementDevices,
      { make: "", model: "", category: "", quantity: 1, deviceType: "Windows" },
    ]);
  };

  const removeBrokenDevice = (index: number) => {
    if (brokenDevices.length > 1) {
      setBrokenDevices(brokenDevices.filter((_, i) => i !== index));
    }
  };

  const removeReplacementDevice = (index: number) => {
    if (replacementDevices.length > 1) {
      setReplacementDevices(replacementDevices.filter((_, i) => i !== index));
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

  const updateBrokenDevice = (index: number, field: keyof BrokenDevice, value: string | number) => {
    setBrokenDevices((prev) => {
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

  const updateReplacementDevice = (index: number, field: keyof BrokenDevice, value: string | number) => {
    setReplacementDevices((prev) => {
      const updated = [...prev];
      const device = updated[index];
      if (!device) return prev;

      if (field === "make" || field === "model") {
        const newMake = field === "make" ? (value as string) : device.make;
        const newModel = field === "model" ? (value as string) : device.model;
        const inferredType = inferDeviceType(newMake, newModel);

        updated[index] = {
          ...device,
          [field]: value,
          ...((device.category.toLowerCase().includes("laptop") || device.category.toLowerCase().includes("desktop")) && inferredType
            ? { deviceType: inferredType }
            : {}),
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

    // Validate structured address fields (for new sites)
    if (selectedSiteId === 'new') {
      if (!siteDetails.siteName?.trim()) return "Site name is required";
      if (!siteDetails.street?.trim()) return "Street address is required";
      if (!siteDetails.city?.trim()) return "City is required";
      if (!siteDetails.postcode?.trim()) return "Postcode is required";
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return "Please enter a valid email address";
    }

    return null;
  };

  const validateStep2 = (): string | null => {
    if (replacementDevices.length === 0) {
      return "At least one replacement device is required";
    }

    for (let i = 0; i < replacementDevices.length; i++) {
      const device = replacementDevices[i];
      if (!device.category.trim()) return `Replacement device ${i + 1}: Category is required`;
      if (!isAccessoriesCategory(device.category)) {
        if (!device.make.trim()) return `Replacement device ${i + 1}: Make is required`;
        if (!device.model.trim()) return `Replacement device ${i + 1}: Model is required`;
      }
      if (!device.quantity || device.quantity < 1) return `Replacement device ${i + 1}: Quantity must be at least 1`;
      if (shouldShowDeviceType(device.category) && !device.deviceType) {
        return `Replacement device ${i + 1}: Device type is required`;
      }
    }

    if (brokenDevices.length === 0) {
      return "At least one broken device is required";
    }

    for (let i = 0; i < brokenDevices.length; i++) {
      const device = brokenDevices[i];
      if (!device.category.trim()) return `Broken device ${i + 1}: Category is required`;
      if (!isAccessoriesCategory(device.category)) {
        if (!device.make.trim()) return `Broken device ${i + 1}: Make is required`;
        if (!device.model.trim()) return `Broken device ${i + 1}: Model is required`;
      }
      if (!device.quantity || device.quantity < 1) return `Broken device ${i + 1}: Quantity must be at least 1`;
      if (shouldShowDeviceType(device.category) && !device.deviceType) {
        return `Broken device ${i + 1}: Device type is required`;
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

      // Build full address from structured fields
      const fullAddress = [
        siteDetails.street?.trim() || "",
        siteDetails.city?.trim() || "",
        siteDetails.county?.trim() || "",
        siteDetails.country?.trim() || ""
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

        // Save new site automatically when using a new address
        if (selectedSiteId === "new") {
          try {
            await createSite.mutateAsync({
              name: siteDetails.siteName,
              address: fullAddress,
              postcode: siteDetails.postcode,
              lat: siteLocation?.lat,
              lng: siteLocation?.lng,
              clientId,
            });
          } catch (error) {
            toast.error("Failed to save site", {
              description: error instanceof Error ? error.message : "Please try again.",
            });
            setIsSubmitting(false);
            return;
          }
        } else {
          // Existing site selected - use its address
          const selectedSite = sites.find((s) => s.id === selectedSiteId);
          if (selectedSite) {
            const bookingAddress = selectedSite.address;
            const bookingPostcode = selectedSite.postcode || "";
            const bookingLat = selectedSite.lat;
            const bookingLng = selectedSite.lng;

            const filteredBroken = brokenDevices
              .filter(d => d.category && d.quantity >= 1)
              .map(d => ({
                ...d,
                deviceType: d.deviceType || inferDeviceTypeFromJmlCategory(d.category),
              }))
              .filter(d => isAccessoriesCategory(d.category) ? true : (!!d.make && !!d.model));

            const filteredReplacement = replacementDevices
              .filter(d => d.category && d.quantity >= 1)
              .map(d => ({
                ...d,
                deviceType: d.deviceType || inferDeviceTypeFromJmlCategory(d.category),
              }))
              .filter(d => isAccessoriesCategory(d.category) ? true : (!!d.make && !!d.model));
            const booking = await jmlBookingService.createBreakfix({
              clientId,
              clientName,
              employeeName: resolvedEmployeeName,
              email,
              address: bookingAddress,
              postcode: bookingPostcode,
              phone,
              siteName: selectedSite ? selectedSite.name : siteDetails.siteName,
              devices: filteredReplacement,
              brokenDevices: filteredBroken,
              deviceType: filteredReplacement[0]?.deviceType ?? filteredBroken[0]?.deviceType ?? 'Windows',
              charityPercent,
              lat: bookingLat,
              lng: bookingLng,
            });

            toast.success("Booking created successfully!", {
              description: `Breakfix booking ${booking.bookingNumber} has been created.`,
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
        
        // For client role, if "new" address is selected, save it automatically
        if (selectedSiteId === "new") {
          try {
            await createSite.mutateAsync({
              name: siteDetails.siteName,
              address: fullAddress,
              postcode: siteDetails.postcode,
              lat: siteLocation?.lat,
              lng: siteLocation?.lng,
              clientId: clientProfile?.id, // Use client's own ID
            });
          } catch (error) {
            toast.error("Failed to save site", {
              description: error instanceof Error ? error.message : "Please try again.",
            });
            setIsSubmitting(false);
            return;
          }
        }
      } else {
        resolvedEmployeeName = user?.name || "User";
      }

      const filteredBroken = brokenDevices
        .filter(d => d.category && d.quantity >= 1)
        .map(d => ({
          ...d,
          deviceType: d.deviceType || inferDeviceTypeFromJmlCategory(d.category),
        }))
        .filter(d => isAccessoriesCategory(d.category) ? true : (!!d.make && !!d.model));

      const filteredReplacement = replacementDevices
        .filter(d => d.category && d.quantity >= 1)
        .map(d => ({
          ...d,
          deviceType: d.deviceType || inferDeviceTypeFromJmlCategory(d.category),
        }))
        .filter(d => isAccessoriesCategory(d.category) ? true : (!!d.make && !!d.model));
      const booking = await jmlBookingService.createBreakfix({
        clientId,
        clientName,
        employeeName: resolvedEmployeeName,
        email,
        address: fullAddress,
        postcode: siteDetails.postcode,
        phone,
        siteName: siteDetails.siteName,
        devices: filteredReplacement,
        brokenDevices: filteredBroken,
        deviceType: filteredReplacement[0]?.deviceType ?? filteredBroken[0]?.deviceType ?? 'Windows',
        charityPercent,
        lat: siteLocation?.lat,
        lng: siteLocation?.lng,
      });

      toast.success("Booking created successfully!", {
        description: `Breakfix booking ${booking.bookingNumber} has been created.`,
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
          <h1 className="text-3xl font-bold">Breakfix Booking</h1>
          <p className="text-muted-foreground">
            Replace a broken device and collect the old one
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
          <div className={cn("grid gap-6 lg:grid-cols-2", isBlocked && "opacity-50 pointer-events-none")}>
            {/* Left Column - Form Fields */}
            <div className="space-y-6">
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

                  {/* Email Address, Phone Number - Side by side */}
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

                  {/* Collection Address */}
                  <div className="space-y-2 p-3 bg-muted/50 rounded-lg border">
                    <Label className="text-sm font-semibold">
                      Collection Address {selectedSiteId === 'new' ? '*' : ''}
                    </Label>
                    {isLoadingSites ? (
                      <div className="flex items-center justify-center py-2">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <Select value={selectedSiteId} onValueChange={handleSiteSelect}>
                        <SelectTrigger className="h-9">
                          <SelectValue>
                            {selectedSiteId === 'new'
                              ? 'New Address'
                              : (() => {
                                  const selectedSite = sites.find(s => s.id === selectedSiteId);
                                  return selectedSite ? selectedSite.name : 'Select a site or create new';
                                })()}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
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

                  {/* Site Name (for new sites) */}
                  {selectedSiteId === 'new' && (
                    <div className="space-y-1.5">
                      <Label htmlFor="siteName" className="text-sm">Site Name *</Label>
                      <Input
                        id="siteName"
                        placeholder="e.g., Main Office, Warehouse, etc."
                        value={siteDetails.siteName}
                        onChange={(e) =>
                          setSiteDetails({ ...siteDetails, siteName: e.target.value })
                        }
                        className="h-9"
                      />
                    </div>
                  )}

                  {/* Address Fields */}
                  <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
                    <div className="space-y-3">
                      {/* Street - Full width */}
                      <div className="space-y-1.5">
                        <Label htmlFor="street" className="text-sm">Street *</Label>
                        <Input
                          id="street"
                          placeholder="123 High Street"
                          value={siteDetails.street}
                          onChange={(e) =>
                            setSiteDetails({ ...siteDetails, street: e.target.value })
                          }
                          disabled={(isAdmin || isReseller) && selectedSiteId !== 'new'}
                          className="h-9"
                        />
                      </div>
                      {/* City, County - Side by side */}
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="city" className="text-sm">City *</Label>
                          <Input
                            id="city"
                            placeholder="London"
                            value={siteDetails.city}
                            onChange={(e) =>
                              setSiteDetails({ ...siteDetails, city: e.target.value })
                            }
                            disabled={(isAdmin || isReseller) && selectedSiteId !== 'new'}
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="county" className="text-sm">County</Label>
                          <Input
                            id="county"
                            placeholder="Greater London"
                            value={siteDetails.county}
                            onChange={(e) =>
                              setSiteDetails({ ...siteDetails, county: e.target.value })
                            }
                            disabled={(isAdmin || isReseller) && selectedSiteId !== 'new'}
                            className="h-9"
                          />
                        </div>
                      </div>
                      {/* Postcode, Country - Side by side */}
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="postcode" className="text-sm">Postcode *</Label>
                          <Input
                            id="postcode"
                            placeholder="EC1A 1BB"
                            value={siteDetails.postcode}
                            onChange={(e) =>
                              setSiteDetails({ ...siteDetails, postcode: e.target.value })
                            }
                            disabled={(isAdmin || isReseller) && selectedSiteId !== 'new'}
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="country" className="text-sm">Country</Label>
                          <Input
                            id="country"
                            value={siteDetails.country}
                            onChange={(e) =>
                              setSiteDetails({ ...siteDetails, country: e.target.value })
                            }
                            disabled={(isAdmin || isReseller) && selectedSiteId !== 'new'}
                            className="h-9"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

            </div>

            {/* Right Column - Map */}
            <div className="space-y-4">
              <Card className="sticky top-4">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MapPin className="h-4 w-4" />
                    Search Address or Select on Map
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Search or click on the map to auto-fill address fields
                  </p>
                </CardHeader>
                <CardContent>
                  <MapPicker
                    position={siteLocation}
                    onPositionChange={(position) => {
                      setSiteLocation(position);
                      // If user selects a location on map while an existing site is selected, switch to 'new' mode
                      if (selectedSiteId !== 'new') {
                        setSelectedSiteId('new');
                        // Reset site details when switching to new address
                        setSiteDetails({
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
                      if (selectedSiteId !== 'new') {
                        setSelectedSiteId('new');
                        // Reset site details when switching to new address
                        setSiteDetails({
                          siteName: "",
                          street: "",
                          city: "",
                          county: "",
                          postcode: "",
                          country: "",
                        });
                      }
                      // Update address fields when creating new site
                      setSiteDetails(prev => ({
                        ...prev,
                        street: details.street !== undefined ? details.street : prev.street,
                        city: details.city !== undefined ? details.city : prev.city,
                        county: details.county !== undefined ? details.county : prev.county,
                        postcode: details.postcode !== undefined ? details.postcode : prev.postcode,
                        country: details.country !== undefined ? details.country : prev.country,
                      }));
                    }}
                    height="450px"
                  />
                  {isGeocodingAddress && (
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Geocoding address...
                    </p>
                  )}
                  {siteLocation && !isGeocodingAddress && (
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      Location set at {siteLocation.lat.toFixed(4)}, {siteLocation.lng.toFixed(4)}
                    </p>
                  )}
                  {!siteLocation && !isGeocodingAddress && selectedSiteId === 'new' && siteDetails.postcode.trim() && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Enter a valid postcode to see location on map
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
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
                <CardTitle>Replacement Device Requirements</CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addReplacementDevice}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Device
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {replacementDevices.map((device, index) => (
                <Card key={index} className="border-2">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-semibold">Device {index + 1}</Label>
                      {replacementDevices.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeReplacementDevice(index)}
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
                            updateReplacementDevice(index, 'category', value);
                            updateReplacementDevice(index, 'deviceType', inferDeviceTypeFromJmlCategory(value));
                            // Auto-assign device type if make/model are already set
                            const current = replacementDevices[index];
                            if (current?.make?.trim() && current?.model?.trim()) {
                              const inferredType = inferDeviceType(current.make, current.model);
                              if ((value.toLowerCase().includes('laptop') || value.toLowerCase().includes('desktop')) && inferredType) {
                                updateReplacementDevice(index, 'deviceType', inferredType);
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
                                onChange={(e) => updateReplacementDevice(index, 'make', e.target.value)}
                                placeholder="Dell, HP, Lenovo, etc."
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>
                                Device Model <span className="text-destructive">*</span>
                              </Label>
                              <Input
                                value={device.model}
                                onChange={(e) => updateReplacementDevice(index, 'model', e.target.value)}
                                placeholder="Latitude 7420, ThinkPad X1, etc."
                              />
                            </div>
                          </>
                        ) : (
                          <div className="md:col-span-2 space-y-2">
                            <Label>Accessories Notes</Label>
                            <Textarea
                              value={device.notes || ""}
                              onChange={(e) => updateReplacementDevice(index, "notes", e.target.value)}
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
                            onChange={(e) => updateReplacementDevice(index, 'quantity', parseInt(e.target.value) || 1)}
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
                              onValueChange={(value) => updateReplacementDevice(index, 'deviceType', value as JmlDeviceType)}
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

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Broken Device Details</CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addBrokenDevice}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Device
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {brokenDevices.map((device, index) => (
                <Card key={index} className="border-2">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-semibold">Device {index + 1}</Label>
                      {brokenDevices.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeBrokenDevice(index)}
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
                            updateBrokenDevice(index, 'category', value);
                            updateBrokenDevice(index, 'deviceType', inferDeviceTypeFromJmlCategory(value));
                            // Auto-assign device type if make/model are already set
                            const device = brokenDevices[index];
                            if (device.make.trim() && device.model.trim()) {
                              const inferredType = inferDeviceType(device.make, device.model);
                              if ((value.toLowerCase().includes('laptop') || value.toLowerCase().includes('desktop')) && inferredType) {
                                updateBrokenDevice(index, 'deviceType', inferredType);
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
                                onChange={(e) => updateBrokenDevice(index, 'make', e.target.value)}
                                placeholder="Dell, HP, Lenovo, etc."
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>
                                Device Model <span className="text-destructive">*</span>
                              </Label>
                              <Input
                                value={device.model}
                                onChange={(e) => updateBrokenDevice(index, 'model', e.target.value)}
                                placeholder="Latitude 7420, ThinkPad X1, etc."
                              />
                            </div>
                          </>
                        ) : (
                          <div className="md:col-span-2 space-y-2">
                            <Label>Accessories Notes</Label>
                            <Textarea
                              value={device.notes || ""}
                              onChange={(e) => updateBrokenDevice(index, "notes", e.target.value)}
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
                            onChange={(e) => updateBrokenDevice(index, 'quantity', parseInt(e.target.value) || 1)}
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
                              onValueChange={(value) => updateBrokenDevice(index, 'deviceType', value as JmlDeviceType)}
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
          {selectedBrokenAssetsForCO2.length > 0 && (
            <Card className="mt-6 bg-gradient-eco border-primary/20">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Leaf className="h-4 w-4 text-primary" />
                  <span className="font-semibold">Environmental Impact Preview</span>
                  {isFetchingCO2 && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
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
                  <div className="pt-3 border-t">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Site Name</span>
                      <span className="font-semibold text-foreground">{siteDetails.siteName || (selectedSiteId !== 'new' ? sites.find(s => s.id === selectedSiteId)?.name : 'N/A')}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Address</span>
                      <span className="font-semibold text-foreground text-right max-w-[60%]">
                        {selectedSiteId === 'new' 
                          ? `${siteDetails.street}, ${siteDetails.city}, ${siteDetails.postcode}`
                          : sites.find(s => s.id === selectedSiteId)?.address || 'N/A'}
                      </span>
                    </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Postcode</span>
                    <span className="font-semibold text-foreground">
                      {siteDetails.postcode || (selectedSiteId !== 'new' ? sites.find(s => s.id === selectedSiteId)?.postcode : 'N/A')}
                    </span>
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
                    <span className="text-muted-foreground">Replacement Devices</span>
                    <span className="font-semibold text-foreground">
                      {replacementDevices.reduce((sum, d) => sum + d.quantity, 0)} units
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Broken/Damaged Devices</span>
                    <span className="font-semibold text-foreground">
                      {brokenDevices.reduce((sum, d) => sum + d.quantity, 0)} units
                    </span>
                  </div>

                  <div className="pt-3 border-t space-y-4">
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Replacement</div>
                      <div className="space-y-2">
                        {replacementDevices.map((device, index) => {
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
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm font-medium">Broken/Damaged</div>
                      <div className="space-y-2">
                        {brokenDevices.map((device, index) => {
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
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-eco border-primary/20 md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Leaf className="h-4 w-4 text-primary" />
                    Impact & Value
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* CO2e Preview */}
                  {selectedBrokenAssetsForCO2.length > 0 && (
                    <div className="space-y-3 pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <Leaf className="h-4 w-4 text-primary" />
                        <span className="font-semibold">Environmental Impact Preview</span>
                        {isFetchingCO2 && (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        )}
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
                          <p className={cn(
                            "text-lg sm:text-3xl font-bold transition-colors break-words overflow-hidden leading-tight",
                            netCO2e > 0 ? "text-success" : netCO2e < 0 ? "text-destructive" : "text-primary"
                          )}>
                            {netCO2e > 0 && "+"}
                            {Math.abs(netCO2e) >= 1000
                              ? `${(netCO2e / 1000).toFixed(1)}t`
                              : `${netCO2e.toFixed(1)}kg`}
                          </p>
                          <p className={cn(
                            "text-xs font-medium mt-1",
                            netCO2e > 0 ? "text-success/80" : "text-muted-foreground"
                          )}>
                            Net Benefit
                            {netCO2e > 0 && " ✓"}
                          </p>
                        </div>
                      </div>

                      <p className={cn(
                        "text-sm text-center font-medium",
                        netCO2e > 0 ? "text-success" : "text-muted-foreground"
                      )}>
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
                  )}

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Estimated Buyback</span>
                    <span className="text-xl font-bold text-foreground">£{buybackTotalPounds.toLocaleString()}</span>
                  </div>
                  <BuybackEstimateDisclaimer />
                </CardContent>
              </Card>
            </div>

            {/* Charity Allocation */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Heart className="h-4 w-4 text-destructive" />
                  Charity Donation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Donate a percentage of your buyback to charity
                    </span>
                    <span className="text-xl font-bold text-foreground">{charityPercent}%</span>
                  </div>
                  <Slider
                    value={[charityPercent]}
                    onValueChange={([val]) => setCharityPercent(val)}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Charity:{" "}
                      <span className="font-semibold text-foreground">
                        £{charityPounds.toLocaleString()}
                      </span>
                    </span>
                    <span className="text-muted-foreground">
                      Your Return:{" "}
                      <span className="font-semibold text-foreground">
                        £{yourReturnPounds.toLocaleString()}
                      </span>
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            
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

export default JMLBreakfix;
