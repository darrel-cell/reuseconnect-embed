import { useState, useEffect, useLayoutEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import * as SelectPrimitive from "@radix-ui/react-select";
import { 
  Building2, 
  Package, 
  Calculator, 
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Plus,
  Minus,
  Leaf,
  Truck,
  TreeDeciduous,
  Heart,
  Calendar,
  MapPin,
  Search,
  Loader2,
  Zap,
  Fuel,
  AlertCircle,
  UserPlus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DatePicker } from "@/components/booking/DatePicker";
import { MapPicker } from "@/components/booking/MapPicker";
import { AddressAutocomplete } from "@/components/booking/AddressAutocomplete";
import { co2eEquivalencies } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { useClients } from "@/hooks/useClients";
import { useSites, useCreateSite } from "@/hooks/useSites";
import { useOrganisationProfileComplete } from "@/hooks/useOrganisationProfile";
import { useAssetCategories } from "@/hooks/useAssets";
import { useCO2Calculation } from "@/hooks/useCO2";
import { useBuybackCalculation } from "@/hooks/useBuyback";
import { useCreateBooking } from "@/hooks/useBooking";
import { geocodePostcode, geocodeAddressWithDetails } from "@/lib/calculations";
import { validateEuropeanPostcode, isValidEuropeanCountry } from "@/lib/european-validation";
import { BookingTypeSelector } from "@/components/booking/BookingTypeSelector";
import { JMLSubTypeSelector } from "@/components/booking/JMLSubTypeSelector";
import { BuybackEstimateDisclaimer } from "@/components/booking/BuybackEstimateDisclaimer";
import { log } from '@/lib/log';
import { UK_TIME_ZONE } from '@/lib/datetime';
import { isAdminLikeRole } from '@/lib/roles';

const steps = [
  { id: 1, title: "Site Details", icon: Building2 },
  { id: 2, title: "Assets", icon: Package },
  { id: 3, title: "Review & Submit", icon: Calculator },
];
const FREE_COURIER_MAX_ITEMS = 5;
const FREE_COURIER_MAX_WEIGHT_KG = 30;

interface AssetSelection {
  categoryId: string;
  quantity: number;
}

type BookingType = 'itad' | 'jml' | 'courier_collection' | null;
type JMLSubType = 'new_starter' | 'leaver' | 'breakfix' | 'mover' | null;

const Booking = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [bookingType, setBookingType] = useState<BookingType>(null);
  const [jmlSubType, setJmlSubType] = useState<JMLSubType>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedClientId, setSelectedClientId] = useState<string>(""); // For resellers: selected client
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined);
  const [siteLocation, setSiteLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<string>("new");
  const [siteDetails, setSiteDetails] = useState({
    siteName: "",
    street: "",
    city: "",
    county: "",
    postcode: "",
    country: "",
    contactName: "",
    contactPhone: "",
  });
  const [selectedAssets, setSelectedAssets] = useState<AssetSelection[]>([]);
  const [charityPercent, setCharityPercent] = useState(10);
  const [selectedVehicleType, setSelectedVehicleType] = useState<'petrol' | 'diesel' | 'electric'>('petrol');
  const [isGeocodingAddress, setIsGeocodingAddress] = useState(false);
  const isCourierCollectionBooking = bookingType === "courier_collection";

  useLayoutEffect(() => {
    if (location.pathname === "/bookings/jml") {
      setBookingType("jml");
      setJmlSubType(null);
      setCurrentStep(1);
    } else if (location.pathname === "/booking/itad") {
      setBookingType("itad");
      setJmlSubType(null);
      setCurrentStep(1);
    } else if (location.pathname === "/booking/courier") {
      setBookingType("courier_collection");
      setJmlSubType(null);
      setCurrentStep(1);
    } else if (location.pathname === "/booking") {
      setBookingType(null);
      setJmlSubType(null);
      setCurrentStep(1);
    }
  }, [location.pathname]);

  // Determine user roles first (needed for conditional queries)
  const isReseller = user?.role === 'partner';
  const isClient = user?.role === 'client';
  const isAdmin = isAdminLikeRole(user?.role);
  const today = new Date();
  
  // Load clients (for resellers and admin only) - only active clients for booking
  const { data: allClients = [], isLoading: isLoadingClients, error: clientsError } = useClients({ status: 'active' });
  
  // Filter to ensure only active clients are shown.
  // Some API responses do not include role, so only enforce role when present.
  const clients = useMemo(() => {
    return allClients.filter((client) => {
      const role = (client as { role?: string }).role;
      const userStatus = (client as { userStatus?: string }).userStatus;
      const isClientRole = role === undefined || role === "client";
      const hasActiveLinkedClientUser = userStatus === "active";
      return client.status === "active" && isClientRole && hasActiveLinkedClientUser;
    });
  }, [allClients]);
  
  // Load sites - for admin/reseller: based on selectedClientId, for client: all their sites
  const { data: sites = [], isLoading: isLoadingSites } = useSites(
    (isAdmin || isReseller) ? selectedClientId : undefined
  );
  
  const { data: assetCategories = [], error: categoriesError, isLoading: isLoadingCategories } = useAssetCategories();
  const itadAssetCategories = useMemo(
    () => assetCategories.filter((category) => !["accessory", "accessories"].includes(category.name.toLowerCase())),
    [assetCategories]
  );
  const displayedAssetCategories = useMemo(() => {
    if (!isCourierCollectionBooking) return itadAssetCategories;
    return itadAssetCategories.filter((category) => {
      const categoryName = category.name.toLowerCase();
      return categoryName.includes("phone") || categoryName.includes("laptop");
    });
  }, [isCourierCollectionBooking, itadAssetCategories]);
  const createBooking = useCreateBooking();
  const createSite = useCreateSite();
  
  // Calculate CO2e when assets change - MUST be called before any early returns (React Hooks rule)
  // Use memoized request object to prevent unnecessary query key changes
  // If location isn't set yet, use a default location for calculations
  const co2CalculationRequest = useMemo(() => {
    if (selectedAssets.length === 0) return null;
    
    // Use actual coordinates if available, otherwise use default (will show as estimated)
    const coordinates = siteLocation || { lat: 51.5074, lng: -0.1278 }; // Default London coordinates
    
    return {
      assets: selectedAssets,
      collectionCoordinates: coordinates,
      vehicleType: selectedVehicleType,
    };
  }, [selectedAssets, siteLocation, selectedVehicleType]);

  const { data: co2Calculation, isLoading: isCalculatingCO2, isFetching: isFetchingCO2 } = useCO2Calculation(co2CalculationRequest);
  
  // Calculate buyback estimate using backend API
  const buybackCalculationRequest = useMemo(() => {
    if (selectedAssets.length === 0) return null;
    return {
      assets: selectedAssets,
    };
  }, [selectedAssets]);

  const { data: buybackCalculation, isLoading: isCalculatingBuyback, isFetching: isFetchingBuyback } = useBuybackCalculation(buybackCalculationRequest);
  
  // Reseller organisation profile completion - MUST be called before any early returns (React Hooks rule)
  const { data: isResellerProfileComplete = false } = useOrganisationProfileComplete(isReseller);
  
  // Reset site selection when client changes (for admin/reseller) - MUST be called before any early returns
  useEffect(() => {
    if ((isAdmin || isReseller) && selectedClientId) {
      setSelectedSiteId("new");
      setSiteDetails({
        siteName: "",
        street: "",
        city: "",
        county: "",
        postcode: "",
        country: "",
        contactName: "",
        contactPhone: "",
      });
      setSiteLocation(null);
    }
  }, [selectedClientId, isAdmin, isReseller]);

  // Auto-geocode postcode when manually entered (for new addresses only)
  useEffect(() => {
    // Only geocode if:
    // 1. Creating new site (not selecting existing)
    // 2. Postcode is entered and valid European format
    if (selectedSiteId !== 'new' || !siteDetails.postcode.trim()) {
      return;
    }

    // Validate European postcode format (with optional country for better validation)
    if (!validateEuropeanPostcode(siteDetails.postcode, siteDetails.country)) {
      return;
    }

    // Debounce geocoding
    const timeoutId = setTimeout(async () => {
      setIsGeocodingAddress(true);
      try {
        // Use enhanced geocoding to get both coordinates and address details
        const result = await geocodeAddressWithDetails(siteDetails.postcode.trim());
        
        if (result.coordinates) {
          setSiteLocation(result.coordinates);
        } else {
          setSiteLocation(null);
        }

        // Auto-populate address fields if available and not already filled
        if (result.address) {
          setSiteDetails(prev => ({
            ...prev,
            // Only update fields that are empty to avoid overwriting user input
            street: prev.street.trim() || result.address?.street || prev.street,
            city: prev.city.trim() || result.address?.city || prev.city,
            county: prev.county.trim() || result.address?.county || prev.county,
            postcode: prev.postcode.trim() || result.address?.postcode || prev.postcode,
            country: prev.country.trim() || result.address?.country || prev.country,
          }));
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

  const totalAssets = selectedAssets.reduce((sum, a) => sum + a.quantity, 0);
  const courierEligibleAssetsSummary = useMemo(() => {
    const selectedAssetCategories = selectedAssets
      .map((asset) => {
        const category = itadAssetCategories.find((c) => c.id === asset.categoryId);
        return {
          name: category?.name || "",
          quantity: asset.quantity,
        };
      })
      .filter((asset) => asset.quantity > 0);

    const isAllowedCategory = (name: string) => {
      const normalised = name.toLowerCase();
      return normalised.includes("phone") || normalised.includes("laptop");
    };

    const allAllowed = selectedAssetCategories.every((asset) => isAllowedCategory(asset.name));
    const overItemLimit = totalAssets > FREE_COURIER_MAX_ITEMS;

    return {
      allAllowed,
      overItemLimit,
      isEligible: selectedAssetCategories.length > 0 && allAllowed && !overItemLimit,
    };
  }, [itadAssetCategories, selectedAssets, totalAssets]);
  
  // Show error if critical data fails to load (AFTER all hooks are called)
  if (categoriesError) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-2">
          <p className="text-destructive">Failed to load asset categories</p>
          <p className="text-sm text-muted-foreground">
            {categoriesError instanceof Error ? categoriesError.message : 'Unknown error'}
          </p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }
  
  // Show loading state while critical data is loading (AFTER all hooks are called)
  if (isLoadingCategories) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
      </div>
    );
  }
  
  // Log client errors but don't block rendering (clients are optional for admin if none exist)
  if (clientsError) {
    log.warn('Failed to load clients:', clientsError);
  }

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
        contactName: "",
        contactPhone: "",
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
          contactName: selectedSite.contactName || "",
          contactPhone: selectedSite.contactPhone || "",
        });
        if (selectedSite.lat && selectedSite.lng) {
          setSiteLocation({ lat: selectedSite.lat, lng: selectedSite.lng });
        } else {
          setSiteLocation(null);
        }
      }
    }
  };
  
  const updateAssetQuantity = (categoryId: string, delta: number) => {
    setSelectedAssets((prev) => {
      const existing = prev.find((a) => a.categoryId === categoryId);
      if (existing) {
        const otherTotal = prev
          .filter((a) => a.categoryId !== categoryId)
          .reduce((sum, a) => sum + a.quantity, 0);
        const maxAllowedForCategory = isCourierCollectionBooking
          ? Math.max(0, FREE_COURIER_MAX_ITEMS - otherTotal)
          : Number.POSITIVE_INFINITY;
        const newQty = Math.max(0, Math.min(existing.quantity + delta, maxAllowedForCategory));
        if (newQty === 0) {
          return prev.filter((a) => a.categoryId !== categoryId);
        }
        return prev.map((a) =>
          a.categoryId === categoryId ? { ...a, quantity: newQty } : a
        );
      } else if (delta > 0) {
        const total = prev.reduce((sum, a) => sum + a.quantity, 0);
        const maxAllowed = isCourierCollectionBooking
          ? Math.max(0, FREE_COURIER_MAX_ITEMS - total)
          : delta;
        const quantityToAdd = Math.min(delta, maxAllowed);
        if (quantityToAdd <= 0) return prev;
        return [...prev, { categoryId, quantity: quantityToAdd }];
      }
      return prev;
    });
  };

  const getAssetQuantity = (categoryId: string) => {
    return selectedAssets.find((a) => a.categoryId === categoryId)?.quantity || 0;
  };

  const buybackEstimate = buybackCalculation?.estimatedBuyback ?? 0;
  const buybackTotalPounds = Math.round(buybackEstimate);
  const charityPounds = Math.round(buybackEstimate * (charityPercent / 100));
  const yourReturnPounds = buybackTotalPounds - charityPounds;

  // Use CO2 calculation from service (useCO2Calculation hook)
  // Use nullish coalescing to keep previous values during refetch (placeholderData handles this)
  const co2eSaved = co2Calculation?.reuseSavings ?? 0;
  const travelEmissions = co2Calculation?.travelEmissions ?? 0;
  const netCO2e = co2Calculation?.netImpact ?? 0;
  const distanceKm = co2Calculation?.distanceKm ?? 0;
  const distanceMiles = co2Calculation?.distanceMiles ?? 0;
  const vehicleEmissions = co2Calculation?.vehicleEmissions ?? {
    petrol: 0,
    diesel: 0,
    electric: 0,
  };

  const canProceed = () => {
    if (isReseller && !isResellerProfileComplete) {
      return false;
    }
    if (currentStep === 1) {
      if ((isReseller || isAdmin) && !selectedClientId && clients.length > 0) {
        return false;
      }
      // Check all required fields (contactName and contactPhone are optional)
      const hasRequiredFields = (
        siteDetails.siteName?.trim() &&
        siteDetails.street?.trim() &&
        siteDetails.city?.trim() &&
        siteDetails.postcode?.trim() &&
        scheduledDate !== undefined
      );
      return hasRequiredFields;
    }
    if (currentStep === 2) {
      if (isCourierCollectionBooking && !courierEligibleAssetsSummary.isEligible) {
        return false;
      }
      return totalAssets > 0;
    }
    if (currentStep === 3) {
      // For step 3, validate all previous steps are complete
      // For admin/reseller: require at least one active client
      if ((isReseller || isAdmin) && !isLoadingClients && clients.length === 0) {
        return false;
      }
      
      if ((isReseller || isAdmin) && !selectedClientId && clients.length > 0) {
        return false;
      }
      const hasStep1Fields = (
        siteDetails.siteName?.trim() &&
        siteDetails.street?.trim() &&
        siteDetails.city?.trim() &&
        siteDetails.postcode?.trim() &&
        scheduledDate !== undefined
      );
      const hasStep2Fields = totalAssets > 0;
      if (isCourierCollectionBooking && !courierEligibleAssetsSummary.isEligible) {
        return false;
      }
      return hasStep1Fields && hasStep2Fields;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (isReseller && !isResellerProfileComplete) {
      toast.error("Complete your organisation profile first", {
        description: "Organisation details are required before creating bookings. Contact support if your profile is incomplete.",
      });
      return;
    }
    if (!scheduledDate) return;
    if (isCourierCollectionBooking && !courierEligibleAssetsSummary.isEligible) {
      toast.error("Free courier collection is not eligible", {
        description: `Only mobiles/laptops are allowed, up to ${FREE_COURIER_MAX_ITEMS} items in total (single box up to ${FREE_COURIER_MAX_WEIGHT_KG}kg).`,
      });
      return;
    }

    // Only admins can schedule bookings for past dates.
    if (!isAdmin) {
      const selectedDay = new Date(scheduledDate);
      selectedDay.setHours(0, 0, 0, 0);
      const currentDay = new Date();
      currentDay.setHours(0, 0, 0, 0);
      if (selectedDay < currentDay) {
        toast.error("Past date is not allowed", {
          description: "Only admin users can create bookings with a past scheduled date.",
        });
        return;
      }
    }
    
    // Prevent submission if no clients available (for admin/reseller)
    if ((isReseller || isAdmin) && clients.length === 0) {
      toast.error("Cannot create booking", {
        description: "No active clients available. Please add or invite clients first.",
      });
      return;
    }
    
    // Combine address parts - always include all 4 parts (even if county is empty) for consistent parsing
    // This matches the format used in Sites page
    // Ensure city is always included if it has a value
    const fullAddress = [
      siteDetails.street?.trim() || "",
      siteDetails.city?.trim() || "", // Always include city (even if empty, to maintain structure)
      siteDetails.county?.trim() || "", // Include empty county to maintain 4-part format
      siteDetails.country?.trim() || ""
    ].join(', ');
    
    // Determine client ID and name
    let bookingClientId: string | undefined;
    let bookingClientName: string | undefined;
    
    if (isReseller || isAdmin) {
      // For resellers and admin: require client selection
      if (!selectedClientId) {
        toast.error("Please select a client", {
          description: "You must select a client to create a booking.",
        });
        return;
      }
      
      bookingClientId = selectedClientId;
      const selectedClient = clients.find(c => c.id === selectedClientId);
      if (!selectedClient) {
        toast.error("Invalid client selected", {
          description: "The selected client is no longer available.",
        });
        return;
      }
      bookingClientName = selectedClient.organisationName || selectedClient.name;
    } else if (isClient && user) {
      // For clients: use their own tenant info (organisation name only)
      bookingClientId = user.tenantId;
      bookingClientName = user.tenantName || 'Client Organisation';
    }
    
    // Handle site creation/selection
    let siteId: string | undefined;
    
    if (selectedSiteId === 'new') {
      // Create new site
      try {
        const newSite = await createSite.mutateAsync({
          name: siteDetails.siteName,
          address: fullAddress,
          postcode: siteDetails.postcode,
          lat: siteLocation?.lat,
          lng: siteLocation?.lng,
          contactName: siteDetails.contactName || undefined,
          contactPhone: siteDetails.contactPhone || undefined,
          clientId: (isAdmin || isReseller) ? bookingClientId : undefined,
        });
        siteId = newSite.id;
      } catch (error) {
        toast.error("Failed to create site", {
          description: error instanceof Error ? error.message : "Please try again.",
        });
        return;
      }
    } else {
      // Use existing site
      siteId = selectedSiteId;
    }
    
    createBooking.mutate(
      {
        clientId: bookingClientId,
        clientName: bookingClientName, // Pass client name explicitly
        siteId: siteId,
        siteName: siteDetails.siteName,
        address: fullAddress,
        postcode: siteDetails.postcode,
        contactName: siteDetails.contactName,
        contactPhone: siteDetails.contactPhone,
        scheduledDate: scheduledDate.toISOString(),
        assets: selectedAssets,
        charityPercent,
        preferredVehicleType: selectedVehicleType, // Default petrol applies when no fuel selector is shown
        bookingType: bookingType === 'jml' ? 'jml' : bookingType === 'courier_collection' ? 'free_collection' : 'itad_collection',
        coordinates: siteLocation || undefined,
      },
      {
        onSuccess: (booking) => {
          toast.success("Booking submitted successfully!", {
            description: `Booking ${booking.bookingNumber ?? booking.id} has been created.`,
          });
          // Redirect to Booking Queue page for admin, or bookings page for others
          if (isAdminLikeRole(user?.role)) {
            navigate(`/admin/bookings`);
          } else {
            navigate(`/bookings`);
          }
        },
        onError: (error) => {
          toast.error("Failed to create booking", {
            description: error instanceof Error ? error.message : "Please try again.",
          });
        },
      }
    );
  };

  const isBlocked = (isReseller || isAdmin) && !isLoadingClients && clients.length === 0 && !clientsError;

  // Hub: ITAD vs JML (only on /booking)
  if (location.pathname === "/booking") {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <BookingTypeSelector onSelect={(type) => {
          if (type === 'jml') {
            navigate('/bookings/jml');
            return;
          }
          if (type === 'courier_collection') {
            navigate('/booking/courier');
            return;
          }
          navigate('/booking/itad');
        }} />
      </div>
    );
  }

  // Dedicated routes: wait for pathname → state sync (useLayoutEffect)
  if (
    (location.pathname === "/booking/itad" && bookingType !== "itad") ||
    (location.pathname === "/booking/courier" && bookingType !== "courier_collection") ||
    (location.pathname === "/bookings/jml" && bookingType !== "jml")
  ) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Show JML sub-type selector if JML selected but sub-type not chosen
  if (bookingType === 'jml' && !jmlSubType) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <JMLSubTypeSelector 
          onSelect={(subType) => {
            setJmlSubType(subType);
            setCurrentStep(1);
          }}
          onBack={() => navigate('/booking')}
        />
      </div>
    );
  }

  // For JML bookings, redirect to JML-specific pages
  if (bookingType === 'jml' && jmlSubType) {
    const to =
      jmlSubType === "new_starter"
        ? "/bookings/jml/new-starter"
        : jmlSubType === "leaver"
          ? "/bookings/jml/leaver"
          : jmlSubType === "breakfix"
            ? "/bookings/jml/breakfix"
            : jmlSubType === "mover"
              ? "/bookings/jml/mover"
              : null;

    if (to) {
      return <Navigate to={to} replace />;
    }
  }

  // ITAD Collection flow (existing code)
  return (
    <div className="max-w-4xl mx-auto space-y-8">
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
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: index * 0.1 }}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full transition-all",
                currentStep >= step.id
                  ? "bg-success/70"
                  : "bg-secondary text-muted-foreground"
              )}
            >
              <step.icon className="h-4 w-4" />
              <span className="font-medium hidden sm:inline">{step.title}</span>
              <span className="font-medium sm:hidden">{step.id}</span>
            </motion.div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "w-12 h-0.5 mx-2",
                  currentStep > step.id ? "bg-success" : "bg-border"
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className={cn("relative", isBlocked && "opacity-50")}>
        <AnimatePresence mode="wait">
          {currentStep === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="grid gap-6 lg:grid-cols-2">
              {/* Left Column - Form Fields */}
              <div className="space-y-6">
              {isCourierCollectionBooking && (
                <Alert className="bg-emerald-500/10 border-emerald-500/30">
                  <AlertDescription>
                    Free courier collection: mobiles and laptops only, up to {FREE_COURIER_MAX_ITEMS} items total (single box up to {FREE_COURIER_MAX_WEIGHT_KG}kg).
                    After admin approval, the team will book courier and tracking details.
                  </AlertDescription>
                </Alert>
              )}
              <Card>
                <CardHeader>
                  <CardTitle>Collection Site Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Client Selection for Resellers and Admin */}
                  {(isReseller || isAdmin) && (
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
                              clients.map((client) => {
                                const organisationName = (client.organisationName || client.tenantName || client.name || "").trim();
                                const employeeName = (client.name || "").trim();
                                const clientLabel = `${organisationName} (${employeeName})`;

                                return (
                                  <SelectItem key={client.id} value={client.id}>
                                    <div className="flex items-center gap-2">
                                      <Building2 className="h-4 w-4" />
                                      <span>{clientLabel}</span>
                                    </div>
                                  </SelectItem>
                                );
                              })
                            )}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  )}

                  {/* Site Selection */}
                  <div className="space-y-2 p-3 bg-muted/50 rounded-lg border">
                    <Label className="text-sm font-semibold">
                      Site Address {selectedSiteId === 'new' ? '*' : ''}
                    </Label>
                    {isLoadingSites ? (
                      <div className="flex items-center justify-center py-2">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <Select
                        value={selectedSiteId}
                        onValueChange={handleSiteSelect}
                      >
                        <SelectTrigger className="bg-background h-9">
                          <SelectPrimitive.Value asChild>
                            <span className="truncate block text-left flex-1">
                              {selectedSiteId === 'new' 
                                ? 'New Address' 
                                : (() => {
                                    const selectedSite = sites.find(s => s.id === selectedSiteId);
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
                            // Split address into two lines if it's long
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

                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="siteName" className="text-sm">Site Name *</Label>
                      <Input
                        id="siteName"
                        placeholder="e.g., London HQ"
                        value={siteDetails.siteName}
                        onChange={(e) =>
                          setSiteDetails({ ...siteDetails, siteName: e.target.value })
                        }
                        disabled={selectedSiteId !== 'new'}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="scheduledDate" className="text-sm">
                        <Calendar className="inline h-3 w-3 mr-1" />
                        Scheduled Date *
                      </Label>
                      <DatePicker
                        date={scheduledDate}
                        onDateChange={setScheduledDate}
                        placeholder="Pick date"
                        minDate={isAdmin ? undefined : today}
                      />
                      <p className="text-xs text-muted-foreground">
                        Preferred Collection Date. This Date is not Guaranteed until approved by Reuse.
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase">Address (use map search or enter manually)</Label>
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
                          disabled={selectedSiteId !== 'new'}
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
                            disabled={selectedSiteId !== 'new'}
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
                            disabled={selectedSiteId !== 'new'}
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
                            disabled={selectedSiteId !== 'new'}
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
                            disabled={selectedSiteId !== 'new'}
                            className="h-9"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="contactName" className="text-sm">Contact Name</Label>
                      <Input
                        id="contactName"
                        placeholder="Site contact person"
                        value={siteDetails.contactName}
                        onChange={(e) =>
                          setSiteDetails({ ...siteDetails, contactName: e.target.value })
                        }
                        disabled={selectedSiteId && selectedSiteId !== 'new'}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="contactPhone" className="text-sm">Contact Phone</Label>
                      <Input
                        id="contactPhone"
                        placeholder="+44 ..."
                        value={siteDetails.contactPhone}
                        onChange={(e) =>
                          setSiteDetails({ ...siteDetails, contactPhone: e.target.value })
                        }
                        disabled={selectedSiteId && selectedSiteId !== 'new'}
                        className="h-9"
                      />
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
                          contactName: "",
                          contactPhone: "",
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
                          contactName: "",
                          contactPhone: "",
                        });
                      }
                      // Update address fields when creating new site
                      setSiteDetails(prev => ({
                        ...prev,
                        // Update fields if provided in details (even if empty string), otherwise keep previous value
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

        {currentStep === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Select Assets for Collection</CardTitle>
              </CardHeader>
              <CardContent>
                {isCourierCollectionBooking && (
                  <Alert className="mb-4 bg-emerald-500/10 border-emerald-500/30">
                    <AlertDescription>
                      Free courier collection allows only mobiles and laptops, up to {FREE_COURIER_MAX_ITEMS} units total.
                      One courier box only, up to {FREE_COURIER_MAX_WEIGHT_KG}kg.
                    </AlertDescription>
                  </Alert>
                )}
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {displayedAssetCategories.map((category) => {
                    const qty = getAssetQuantity(category.id);
                    const isSelected = qty > 0;
                    const remainingCourierAllowance = Math.max(FREE_COURIER_MAX_ITEMS - totalAssets, 0);
                    const canIncreaseForCourier = !isCourierCollectionBooking || remainingCourierAllowance > 0;
                    return (
                      <div
                        key={category.id}
                        className={cn(
                          "p-4 rounded-xl border-2 transition-all",
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <div className="text-center mb-3">
                          <span className="text-3xl">{category.icon}</span>
                          <p className="font-medium mt-1">{category.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {["weee waste", "mixed weee"].includes(category.name.toLowerCase()) ? (
                              <>~{category.co2ePerUnit}kg CO₂e/t waste</>
                            ) : (
                              <>~{category.co2ePerUnit}kg CO₂e/unit</>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateAssetQuantity(category.id, -5)}
                            disabled={qty === 0}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <Input
                            type="number"
                            min="0"
                            value={qty}
                            onChange={(e) => {
                              const rawVal = parseInt(e.target.value) || 0;
                              const val = isCourierCollectionBooking
                                ? Math.max(0, Math.min(rawVal, FREE_COURIER_MAX_ITEMS))
                                : Math.max(0, rawVal);
                              setSelectedAssets((prev) => {
                                const filtered = prev.filter(
                                  (a) => a.categoryId !== category.id
                                );
                                const otherSelectedTotal = filtered.reduce((sum, a) => sum + a.quantity, 0);
                                const cappedVal = isCourierCollectionBooking
                                  ? Math.max(0, Math.min(val, FREE_COURIER_MAX_ITEMS - otherSelectedTotal))
                                  : val;
                                if (cappedVal > 0) {
                                  return [...filtered, { categoryId: category.id, quantity: cappedVal }];
                                }
                                return filtered;
                              });
                            }}
                            className="w-20 text-center h-8"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => updateAssetQuantity(category.id, 5)}
                            disabled={!canIncreaseForCourier}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* CO2e Preview */}
                {totalAssets > 0 && (
                  isCourierCollectionBooking && !courierEligibleAssetsSummary.isEligible ? (
                    <Alert className="mt-6 bg-warning/10 border-warning/30">
                      <AlertDescription>
                        This selection is not eligible for free courier collection. Use only mobiles/laptops and keep total quantity at {FREE_COURIER_MAX_ITEMS} or less.
                      </AlertDescription>
                    </Alert>
                  ) : null
                )}

                {totalAssets > 0 && (
                  <motion.div
                    key="co2-preview"
                    layoutId="co2-preview"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={cn(
                      "mt-6 p-4 rounded-xl bg-gradient-eco border border-primary/20 transition-opacity duration-200",
                      isFetchingCO2 && "opacity-75"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Leaf className="h-5 w-5 text-primary" />
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
                        <p className={cn(
                          "text-lg sm:text-2xl font-bold break-words overflow-hidden leading-tight",
                          selectedVehicleType === 'electric' ? "text-success" : "text-destructive"
                        )}>
                          {selectedVehicleType === 'electric' ? '0kg' : `-${travelEmissions.toFixed(1)}kg`}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 break-words">Travel Emissions ({selectedVehicleType.charAt(0).toUpperCase() + selectedVehicleType.slice(1)})</p>
                      </div>
                      <div className={cn(
                        "min-w-0 overflow-hidden",
                        netCO2e > 0 && "relative"
                      )}>
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
                      "text-sm text-center mt-3 font-medium",
                      netCO2e > 0 ? "text-success" : "text-muted-foreground"
                    )}>
                      {netCO2e > 0 && "✓ "}
                      ≈ {co2eEquivalencies.treesPlanted(netCO2e)} trees planted equivalent
                      {netCO2e > 0 && " - Great environmental impact!"}
                    </p>
                  </motion.div>
                )}

                {/* Travel Distance & Emissions Box */}
                {totalAssets > 0 && !isCourierCollectionBooking && (distanceKm > 0 || isCalculatingCO2) && (
                  <motion.div
                    key="travel-emissions"
                    layoutId="travel-emissions"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={cn(
                      "mt-6 p-4 rounded-xl border bg-card transition-opacity duration-200",
                      isFetchingCO2 && "opacity-75"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <Truck className="h-5 w-5 text-primary" />
                      <span className="font-semibold">Travel Distance & Emissions</span>
                      {isFetchingCO2 && (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Total Mileage (Round Trip)</span>
                        </div>
                        <span className="text-lg font-bold">
                          {distanceMiles > 0 ? `${distanceMiles.toFixed(1)} miles (${distanceKm.toFixed(1)} km)` : 'Calculating...'}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mb-3">
                        From collection site to warehouse (RM13 8BT) and return
                        {!siteLocation && (
                          <span className="ml-2 text-warning">(Estimated - Location not set)</span>
                        )}
                      </div>
                      <div className="text-sm font-medium mb-2">
                        Select vehicle type to see emissions:
                      </div>
                      <div className="grid grid-cols-3 gap-2 sm:gap-3">
                        <button
                          type="button"
                          onClick={() => setSelectedVehicleType('petrol')}
                          className={cn(
                            "p-2 sm:p-3 rounded-lg border bg-background transition-all cursor-pointer text-left min-w-0",
                            selectedVehicleType === 'petrol' 
                              ? "border-primary bg-primary/5 ring-2 ring-primary/20" 
                              : "hover:border-primary/50 hover:bg-muted/50"
                          )}
                        >
                          <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2">
                            <Fuel className="h-3 w-3 sm:h-4 sm:w-4 text-orange-500 flex-shrink-0" />
                            <span className="text-xs font-semibold text-muted-foreground truncate">Petrol</span>
                            {selectedVehicleType === 'petrol' && (
                              <CheckCircle2 className="h-3 w-3 text-primary ml-auto flex-shrink-0" />
                            )}
                          </div>
                          <p className={cn(
                            "text-sm sm:text-xl font-bold overflow-hidden leading-tight",
                            selectedVehicleType === 'petrol' ? "text-primary" : "text-foreground"
                          )}>
                            {distanceKm > 0 ? `${vehicleEmissions.petrol.toFixed(2)}kg` : '—'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 sm:mt-1">CO₂e</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedVehicleType('diesel')}
                          className={cn(
                            "p-2 sm:p-3 rounded-lg border bg-background transition-all cursor-pointer text-left min-w-0",
                            selectedVehicleType === 'diesel' 
                              ? "border-primary bg-primary/5 ring-2 ring-primary/20" 
                              : "hover:border-primary/50 hover:bg-muted/50"
                          )}
                        >
                          <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2">
                            <Fuel className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500 flex-shrink-0" />
                            <span className="text-xs font-semibold text-muted-foreground truncate">Diesel</span>
                            {selectedVehicleType === 'diesel' && (
                              <CheckCircle2 className="h-3 w-3 text-primary ml-auto flex-shrink-0" />
                            )}
                          </div>
                          <p className={cn(
                            "text-sm sm:text-xl font-bold overflow-hidden leading-tight",
                            selectedVehicleType === 'diesel' ? "text-primary" : "text-foreground"
                          )}>
                            {distanceKm > 0 ? `${vehicleEmissions.diesel.toFixed(2)}kg` : '—'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 sm:mt-1">CO₂e</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedVehicleType('electric')}
                          className={cn(
                            "p-2 sm:p-3 rounded-lg border bg-background transition-all cursor-pointer text-left min-w-0",
                            selectedVehicleType === 'electric' 
                              ? "border-primary bg-primary/5 ring-2 ring-primary/20" 
                              : "hover:border-primary/50 hover:bg-muted/50"
                          )}
                        >
                          <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2">
                            <Zap className="h-3 w-3 sm:h-4 sm:w-4 text-green-500 flex-shrink-0" />
                            <span className="text-xs font-semibold text-muted-foreground truncate">Electric</span>
                            {selectedVehicleType === 'electric' && (
                              <CheckCircle2 className="h-3 w-3 text-primary ml-auto flex-shrink-0" />
                            )}
                          </div>
                          <p className={cn(
                            "text-sm sm:text-xl font-bold overflow-hidden leading-tight",
                            selectedVehicleType === 'electric' ? "text-success" : "text-foreground"
                          )}>
                            {distanceKm > 0 ? '0kg' : '—'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 sm:mt-1">CO₂e</p>
                        </button>
                      </div>
                      {selectedVehicleType && distanceKm > 0 && vehicleEmissions && (
                        <div className="mt-3 p-2 rounded-lg bg-muted/50 text-sm text-center">
                          Selected: <span className="font-semibold capitalize">{selectedVehicleType}</span> vehicle ({selectedVehicleType === 'electric' ? '0kg' : (vehicleEmissions[selectedVehicleType as keyof typeof vehicleEmissions] || 0).toFixed(2) + 'kg'} CO₂e)
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {currentStep === 3 && (
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
                  <CardTitle className="text-base">Collection Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Site</span>
                    <span className="font-semibold text-foreground">{siteDetails.siteName}</span>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm">
                    <span className="text-muted-foreground">Address</span>
                    <span className="font-semibold text-foreground text-right max-w-[60%]">
                      {[siteDetails.street, siteDetails.city, siteDetails.postcode].filter(Boolean).join(", ")}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Postcode</span>
                    <span className="font-semibold text-foreground">{siteDetails.postcode}</span>
                  </div>
                  {scheduledDate && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Scheduled Date</span>
                      <span className="font-semibold text-foreground">
                        {scheduledDate.toLocaleDateString("en-GB", { timeZone: UK_TIME_ZONE,
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Assets</span>
                    <span className="font-semibold text-foreground">{totalAssets} units</span>
                  </div>
                  <div className="pt-3 border-t">
                    {selectedAssets.map((asset) => {
                      const cat = assetCategories.find((c) => c.id === asset.categoryId);
                      const isWeee = ["weee waste", "mixed weee"].includes(cat?.name?.toLowerCase() || "");
                      return (
                        <div key={asset.categoryId} className="flex justify-between text-sm py-1">
                          <span className="text-muted-foreground">{cat?.icon} {cat?.name}</span>
                          <span className="font-semibold text-foreground">
                            {asset.quantity}
                            {isWeee ? "t" : ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-eco border-primary/20 md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Leaf className="h-4 w-4 text-primary" />
                    {isCourierCollectionBooking ? "Collection Summary" : "Impact & Value"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Estimated Buyback</span>
                    <span className="text-xl font-bold text-foreground">
                      {isCourierCollectionBooking ? '-' : `£${buybackTotalPounds.toLocaleString()}`}
                    </span>
                  </div>
                  {!isCourierCollectionBooking && <BuybackEstimateDisclaimer />}

                  {/* Return Journey Mileage - hidden for free courier collection */}
                  {!isCourierCollectionBooking && selectedVehicleType && distanceKm > 0 && (
                    <div className="p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Return Journey Mileage</span>
                        </div>
                        <span className="text-lg font-bold">
                          {distanceMiles > 0 ? `${distanceMiles.toFixed(1)} miles (${distanceKm.toFixed(1)} km)` : 'Calculating...'}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-2">
                        From collection site to warehouse (RM13 8BT) and return
                        {!siteLocation && (
                          <span className="ml-2 text-warning">(Estimated - Location not set)</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Environmental Impact - Integrated design */}
                  <div className="space-y-3 pt-2 border-t">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <TreeDeciduous className="h-4 w-4 text-success" />
                        <span className="text-sm text-muted-foreground">Reuse Savings</span>
                      </div>
                      <span className="text-lg font-bold text-success">
                        {co2eSaved >= 1000 
                          ? `${(co2eSaved / 1000).toFixed(1)}t` 
                          : `${co2eSaved.toFixed(2)}kg`} CO₂e
                      </span>
                    </div>

                    {/* Vehicle Emissions - Only shown when vehicle is selected */}
                    {!isCourierCollectionBooking && selectedVehicleType && distanceKm > 0 && (
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <Fuel className={cn(
                            "h-4 w-4",
                            selectedVehicleType === 'petrol' ? "text-orange-500" :
                            selectedVehicleType === 'diesel' ? "text-blue-500" :
                            "text-green-500"
                          )} />
                          <span className="text-sm text-muted-foreground">
                            Vehicle CO₂ Emissions <span className="text-xs capitalize">({selectedVehicleType})</span>
                          </span>
                        </div>
                        <span className="text-lg font-bold text-foreground">
                          {selectedVehicleType === 'electric' ? '0kg' : `${travelEmissions.toFixed(2)}kg`} CO₂e
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <Leaf className={cn(
                          "h-4 w-4",
                          netCO2e > 0 ? "text-success" : 
                          netCO2e < 0 ? "text-destructive" :
                          "text-muted-foreground"
                        )} />
                        <span className="text-sm font-semibold text-foreground">Net CO₂ Impact</span>
                      </div>
                      <div className="text-right">
                        <span className={cn(
                          "text-2xl font-bold transition-colors",
                          netCO2e > 0 ? "text-success" : 
                          netCO2e < 0 ? "text-destructive" :
                          "text-foreground"
                        )}>
                          {netCO2e > 0 && "+"}
                          {Math.abs(netCO2e) >= 1000 
                            ? `${(netCO2e / 1000).toFixed(1)}t` 
                            : `${netCO2e.toFixed(2)}kg`} CO₂e
                          {netCO2e > 0 && (
                            <span className="ml-2 text-lg">✓</span>
                          )}
                        </span>
                        {!isCourierCollectionBooking && selectedVehicleType && distanceKm > 0 && (
                          <p className={cn(
                            "text-xs mt-1",
                            netCO2e > 0 ? "text-success/80" : 
                            netCO2e < 0 ? "text-destructive/80" :
                            "text-muted-foreground"
                          )}>
                            {netCO2e > 0 
                              ? "Positive environmental benefit" 
                              : netCO2e < 0 
                              ? "Travel emissions exceed reuse savings"
                              : "Neutral impact"}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2 border-t">
                    <span className="flex items-center gap-1">
                      <TreeDeciduous className="h-4 w-4" />
                      {co2eEquivalencies.treesPlanted(netCO2e)} trees
                    </span>
                    <span className="flex items-center gap-1">
                      <Truck className="h-4 w-4" />
                      {co2eEquivalencies.carMiles(netCO2e)} miles saved
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2">
                    <span className="flex items-center gap-1">
                      <TreeDeciduous className="h-4 w-4" />
                      {co2eEquivalencies.treesPlanted(co2eSaved)} trees from CO₂e saved
                    </span>
                    <span className="flex items-center gap-1">
                      <Truck className="h-4 w-4" />
                      {co2eEquivalencies.carMiles(co2eSaved)} miles from CO₂e saved
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {!isCourierCollectionBooking && (
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
                        Charity: <span className="font-semibold text-foreground">£{charityPounds.toLocaleString()}</span>
                      </span>
                      <span className="text-muted-foreground">
                        Your Return: <span className="font-semibold text-foreground">£{yourReturnPounds.toLocaleString()}</span>
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Overlay when blocked */}
      {isBlocked && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm rounded-lg flex items-center justify-center z-10 pointer-events-auto">
          <div className="text-center space-y-4 p-8 bg-card border rounded-lg shadow-lg">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground" />
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">No Active Clients</h3>
              <p className="text-sm text-muted-foreground mb-4">
                You need to add at least one active client before creating a booking.
              </p>
              <Button
                variant="default"
                onClick={() => navigate('/clients')}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Go to Clients Page
              </Button>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => {
            if (currentStep === 1) {
              navigate('/booking');
              return;
            }
            setCurrentStep((s) => s - 1);
          }}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        {currentStep < 3 ? (
          <Button
          variant="outline"
            onClick={() => setCurrentStep((s) => s + 1)}
            disabled={!canProceed() || ((isReseller || isAdmin) && !isLoadingClients && clients.length === 0)}
          >
            Continue
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button
            variant="default"
            onClick={handleSubmit}
            disabled={createBooking.isPending || !canProceed() || ((isReseller || isAdmin) && !isLoadingClients && clients.length === 0)}
          >
            {createBooking.isPending ? (
              <>
                <Loader2 className="animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <CheckCircle2 />
                Submit Booking
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
};

export default Booking;
