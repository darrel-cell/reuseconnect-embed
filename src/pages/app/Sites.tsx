import { useState, useEffect } from "react";
import type { Site } from "@/services/site.service";
import { motion } from "framer-motion";
import { 
  Search, 
  MapPin, 
  Plus, 
  Edit, 
  Trash2, 
  Loader2, 
  X, 
  Building2,
  Phone,
  Mail,
  AlertCircle
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/auth-context";
import { useSitesPage, useCreateSite, useUpdateSite, useDeleteSite } from "@/hooks/useSites";
import { useClients } from "@/hooks/useClients";
import { ListPagination } from "@/components/common/ListPagination";
import { ViewModeToggle } from "@/components/common/ViewModeToggle";
import { InfoTooltip } from "@/components/common/InfoTooltip";
import { usePersistedViewMode } from "@/hooks/usePersistedViewMode";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { geocodePostcode } from "@/lib/calculations";
import { 
  validateEuropeanPostcode, 
  isValidEuropeanCountry, 
  normalizeEuropeanCountry,
  extractEuropeanPostcode,
  getCountryCode
} from "@/lib/european-validation";
import type { CreateSiteRequest, UpdateSiteRequest } from "@/services/site.service";
import { log } from '@/lib/log';
import { isAdminLikeRole } from '@/lib/roles';

/**
 * The subset of a Nominatim geocoding result this screen reads.
 *
 * Third-party response, so only the fields actually used are declared — enough
 * for the compiler to catch a typo in `address.county`, which is the mistake
 * that would otherwise silently fail postcode validation.
 */
type GeocodeResult = {
  lat?: string;
  lon?: string;
  display_name?: string;
  address?: {
    country?: string;
    county?: string;
    state?: string;
    province?: string;
    region?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    locality?: string;
    post_town?: string;
    road?: string;
    postcode?: string;
  };
};

const Sites = () => {
  const { user } = useAuth();
  const isAdmin = isAdminLikeRole(user?.role);
  const isClient = user?.role === 'client';
  
  const [searchQuery, setSearchQuery] = useState("");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [sitesPage, setSitesPage] = useState(1);
  const [sitesLimit, setSitesLimit] = useState(20);
  const [viewMode, setViewMode] = usePersistedViewMode("sites-view", "card");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  // Field-specific validation errors and warnings (reasons stored internally, not displayed)
  const [fieldErrors, setFieldErrors] = useState<{
    street?: string;
    city?: string;
    county?: string;
    postcode?: string;
  }>({});
  const [fieldWarnings, setFieldWarnings] = useState<{
    street?: string;
    city?: string;
    county?: string;
  }>({});
  const [isValid, setIsValid] = useState(false);
  
  // Form state - separate address fields to match booking form
  const [formData, setFormData] = useState({
    name: "",
    street: "",
    city: "",
    county: "",
    country: "",
    postcode: "",
    contactName: "",
    contactPhone: "",
    clientId: undefined,
    lat: undefined,
    lng: undefined,
  });

  // Fetch sites - admin can filter by client, client sees only their own.
  // Paged, because /sites used to return every row in the tenant.
  const { sites, pagination, isLoading, isFetching, error } = useSitesPage({
    clientId: isAdmin && clientFilter !== "all" ? clientFilter : undefined,
    page: sitesPage,
    limit: sitesLimit,
  });

  // Fetch clients for admin dropdown
  const { data: clients = [] } = useClients({});

  const createSite = useCreateSite();
  const updateSite = useUpdateSite();
  const deleteSite = useDeleteSite();

  // Filter sites by search query
  const filteredSites = sites.filter((site) => {
    const matchesSearch =
      site.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      site.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      site.postcode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (site.contactName && site.contactName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (site.contactPhone && site.contactPhone.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return matchesSearch;
  });

  const handleCreate = () => {
      setFormData({
        name: "",
        street: "",
        city: "",
        county: "",
        country: "",
        postcode: "",
        contactName: "",
        contactPhone: "",
        clientId: undefined,
        lat: undefined,
        lng: undefined,
      });
      setFieldErrors({});
      setFieldWarnings({});
      setIsValid(false);
      setSelectedSite(null);
      setIsCreateDialogOpen(true);
  };

  const handleEdit = (site: Site) => {
    // Parse address from saved site
    // Format: "street, city, county, country" (4 parts, but street may contain commas)
    // We need to parse from the end to handle cases where street contains commas
    const addressParts = site.address.split(',').map((s: string) => s.trim());
    
    // Smart parsing: check if any part is a known European country
    const lastPart = addressParts[addressParts.length - 1] || "";
    const isCountryInLastPart = isValidEuropeanCountry(lastPart);
    
    let street = "";
    let city = "";
    let county = "";
    let country = "";
    
    if (addressParts.length >= 2) {
      // Always take the last part as country (if it's a valid country)
      if (isCountryInLastPart) {
        country = lastPart;
        
        // If we have at least 3 parts, second-to-last is county (or city if only 3 parts)
        if (addressParts.length >= 3) {
          const secondLast = addressParts[addressParts.length - 2] || "";
          
          if (addressParts.length === 3) {
            // Format: "street, city, country" (county was empty)
            street = addressParts[0] || "";
            city = addressParts[1] || "";
            county = "";
          } else if (addressParts.length === 4) {
            // Format: "street, city, county, country"
            street = addressParts[0] || "";
            city = addressParts[1] || "";
            county = addressParts[2] || "";
          } else {
            // More than 4 parts: street contains commas
            // Take last 3 parts as: city, county, country
            // Everything before is street
            city = addressParts[addressParts.length - 3] || "";
            county = addressParts[addressParts.length - 2] || "";
            // Join all parts before the last 3 as street
            street = addressParts.slice(0, addressParts.length - 3).join(', ') || "";
          }
        } else {
          // Only 2 parts: "street, country" (shouldn't happen, but handle it)
          street = addressParts[0] || "";
          city = "";
          county = "";
        }
      } else {
        // Last part is not a country - fallback parsing
        // Try to identify country from the end
        if (addressParts.length >= 4) {
          // Assume last 3 are: city, county, country
          city = addressParts[addressParts.length - 3] || "";
          county = addressParts[addressParts.length - 2] || "";
          country = addressParts[addressParts.length - 1] || "";
          street = addressParts.slice(0, addressParts.length - 3).join(', ') || "";
        } else if (addressParts.length === 3) {
          // Assume: street, city, country
          street = addressParts[0] || "";
          city = addressParts[1] || "";
          county = "";
          country = addressParts[2] || "";
        } else {
          // Fallback: just take first as street, rest as city
          street = addressParts[0] || "";
          city = addressParts.slice(1).join(', ') || "";
        }
      }
    }
    
    setFormData({
      name: site.name,
      street,
      city,
      county,
      country,
      postcode: site.postcode,
      contactName: site.contactName || "",
      contactPhone: site.contactPhone || "",
      clientId: site.clientId,
      lat: site.lat,
      lng: site.lng,
    });
    setFieldErrors({});
    setFieldWarnings({});
    setIsValid(false);
    setSelectedSite(site);
    setIsEditDialogOpen(true);
  };

  const handleDelete = (site: Site) => {
    setSelectedSite(site);
    setIsDeleteDialogOpen(true);
  };

  // Use European postcode validation
  const validatePostcode = (postcode: string, country?: string): boolean => {
    return validateEuropeanPostcode(postcode, country);
  };

  // Auto-verify when postcode or address fields change
  useEffect(() => {
    if (!formData.postcode.trim() || !validatePostcode(formData.postcode, formData.country)) {
      setIsValid(false);
      setFieldErrors({});
      setFieldWarnings({});
      return;
    }

    // Always verify if country is entered (required field)
    // Also verify if city is entered (required field)
    if (!formData.city.trim() && !formData.country.trim()) {
      setIsValid(false);
      setFieldErrors({});
      setFieldWarnings({});
      return;
    }

    // Debounce verification
    const timeoutId = setTimeout(async () => {
      await verifyAddressFields();
    }, 1000);

    return () => clearTimeout(timeoutId);
    // verifyAddressFields reads only these formData fields, so the closure is
    // always current; adding the function itself would change nothing about when
    // this runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.postcode, formData.street, formData.city, formData.county, formData.country]);

  async function verifyAddressFields() {
    if (!formData.postcode.trim() || !validatePostcode(formData.postcode, formData.country)) {
      setIsValid(false);
      setFieldErrors({});
      setFieldWarnings({});
      return;
    }

    setIsVerifying(true);
    setFieldErrors({});
    setFieldWarnings({});

    try {
      const verification = await verifyPostcodeMatch(
        formData.postcode,
        formData.street,
        formData.city,
        formData.county,
        formData.country
      );

      // Set field-specific errors and warnings (reasons stored internally, not displayed)
      if (verification.fieldErrors) {
        setFieldErrors(verification.fieldErrors);
      } else {
        setFieldErrors({});
      }

      if (verification.fieldWarnings) {
        setFieldWarnings(verification.fieldWarnings);
      } else {
        setFieldWarnings({});
      }

      // Set overall validation state
      const hasErrors = verification.fieldErrors && Object.keys(verification.fieldErrors).length > 0;
      setIsValid(!hasErrors);

      // Update coordinates if available
      if (verification.coordinates) {
        setFormData(prev => ({
          ...prev,
          lat: verification.coordinates!.lat,
          lng: verification.coordinates!.lng,
        }));
      }
    } catch (error) {
      setIsValid(true); // Allow submission on error (don't block)
      setFieldErrors({});
      setFieldWarnings({});
    } finally {
      setIsVerifying(false);
    }
  }

  // Verify postcode matches all address fields by geocoding
  async function verifyPostcodeMatch(postcode: string, street: string, city: string, county: string, country: string) {
    if (!postcode.trim() || !validatePostcode(postcode, country)) {
      return { match: true };
    }

    try {
      // Geocode postcode to get actual address details - fetch multiple results to check if city is valid
      // Postcodes can cover multiple cities, so we need to check multiple results
      // Using maximum limit=40 to get comprehensive coverage of all cities for a postcode
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(postcode)}&limit=40&addressdetails=1`
      );
      const allData = await response.json();
      
      if (allData.length === 0) {
        return { match: true, error: "Postcode not found" };
      }

      const enteredCountry = country.trim().toLowerCase();
      const normalizedEnteredCountry = normalizeEuropeanCountry(enteredCountry);
      
      // CRITICAL: Filter results to only those matching the entered country
      // Same postcode can exist in multiple countries (e.g., "77120" in France and Finland)
      // We must only validate against results from the correct country
      const data = allData.filter((r: GeocodeResult) => {
        const geocodedCountry = (r.address?.country || "").toLowerCase();
        const normalizedGeocodedCountry = normalizeEuropeanCountry(geocodedCountry);
        return normalizedEnteredCountry && normalizedGeocodedCountry && 
               normalizedEnteredCountry === normalizedGeocodedCountry;
      });
      
      // If no results match the entered country, the postcode doesn't exist in that country
      // This is a CRITICAL ERROR - block submission
      if (data.length === 0) {
        // Find a sample result from a different country to show in error message
        const sampleResult = allData[0];
        const sampleCountry = sampleResult.address?.country || "Unknown";
        const sampleCounty = sampleResult.address?.county || sampleResult.address?.state || "Unknown";
        return {
          match: false,
          isError: true, // Critical error - block submission
          error: `Postcode not found in ${country}. Found in: ${sampleCountry}`,
          fieldErrors: { postcode: `Postcode not found in ${country}` },
          fieldWarnings: {},
          suggestedCountry: sampleCountry,
          suggestedCounty: sampleCounty,
          suggestions: [`Country: ${sampleCountry}`, `County: ${sampleCounty}`],
        };
      }

      // Use first result as primary, but check all results for city matches (all from correct country now)
      const result = data[0];
      // Get city from first result (for comparison purposes)
      const geocodedCity = (result.address?.city || result.address?.town || result.address?.village || result.address?.municipality || "").toLowerCase();
      // Get county from first result, but also check all results for county matches
      const geocodedCounty = (result.address?.county || result.address?.state || result.address?.region || result.address?.province || "").toLowerCase();
      const geocodedCountry = (result.address?.country || "").toLowerCase();
      const geocodedStreet = (result.address?.road || "").toLowerCase();
      
      const enteredCity = city.trim().toLowerCase();
      const enteredCounty = county.trim().toLowerCase();
      const enteredStreet = street.trim().toLowerCase();

      // Check if entered city appears in any of the geocoded results (postcodes can cover multiple cities)
      // Also check all administrative levels (city, town, village, municipality) from all results
      // Also check display_name for city names (some cities might only appear there)
      // Note: all results are now from the correct country
      const allGeocodedCities = data.map((r: GeocodeResult) => {
        const cities = [
          r.address?.city,
          r.address?.town,
          r.address?.village,
          r.address?.municipality,
          r.address?.locality,
          r.address?.post_town // UK addresses
        ].filter(Boolean).map((c: string) => c.toLowerCase());
        
        // Also extract city names from display_name (e.g., "Beautheil-Saints, Seine-et-Marne, France")
        if (r.display_name) {
          const displayParts = r.display_name.split(',').map((p: string) => p.trim().toLowerCase());
          // The first part is usually the most specific location (city/town)
          if (displayParts.length > 0 && displayParts[0]) {
            cities.push(displayParts[0]);
          }
        }
        
        return cities;
      }).flat().filter((c: string, index: number, self: string[]) => self.indexOf(c) === index); // Remove duplicates
      
      // Helper function to detect obviously invalid entries (pure numbers, too short, no letters)
      const isObviouslyInvalid = (value: string, fieldType: 'city' | 'county' | 'street'): boolean => {
        if (!value || value.trim().length === 0) return false; // Empty is handled elsewhere
        
        const trimmed = value.trim();
        
        // Pure numeric strings without context are invalid
        if (/^\d+$/.test(trimmed)) {
          return true; // Pure numbers like "123", "123123" are invalid
        }
        
        // Too short (less than 2 characters) is suspicious
        if (trimmed.length < 2) {
          return true;
        }
        
        // Check for allowed numeric patterns with context (Sector 7, Zone 3, District 9, Area 51)
        const allowedNumericPatterns = /^(sector|zone|district|area|route|road|rd|street|st|avenue|ave|boulevard|blvd|drive|dr|lane|ln|way|wy)\s+\d+/i;
        if (allowedNumericPatterns.test(trimmed)) {
          return false; // Allowed pattern
        }
        
        // For city and county: must contain at least one letter OR be a known address token
        if (fieldType === 'city' || fieldType === 'county') {
          if (!/[a-zA-ZÀ-ÿ]/.test(trimmed)) {
            return true; // No letters at all - invalid
          }
        }
        
        // For street: can be just numbers (like "123 Main St"), but if it's just numbers with no context, it's suspicious
        // Also allow numeric routes (A4, B27, D917)
        if (fieldType === 'street') {
          const numericRoutePattern = /^[A-Z]\d+$/i;
          if (numericRoutePattern.test(trimmed)) {
            return false; // Numeric routes like A4, B27, D917 are allowed
          }
        }
        
        return false;
      };
      
      // Helper function for strict matching: requires minimum length and word boundary matching
      // Prevents single character matches (e.g., "S" matching "Seine-et-Marne")
      // Enhanced to handle hyphenated city names and variations
      const strictMatch = (entered: string, geocoded: string): boolean => {
        if (!entered || !geocoded) return false;
        
        // Normalize both strings (remove extra spaces, normalize hyphens/spaces, handle accents)
        const normalize = (str: string) => {
          return str.toLowerCase()
            .trim()
            .replace(/[\s-]+/g, ' ') // Normalize hyphens and spaces
            .normalize('NFD') // Decompose accented characters
            .replace(/[\u0300-\u036f]/g, ''); // Remove diacritics
        };
        
        const normalizedEntered = normalize(entered);
        const normalizedGeocoded = normalize(geocoded);
        
        // Exact match after normalization (handles "Beautheil-Saints" vs "Beautheil Saints")
        if (normalizedEntered === normalizedGeocoded) {
          return true;
        }
        
        // Require minimum 3 characters for meaningful comparison
        if (normalizedEntered.length < 3 && normalizedGeocoded.length < 3) {
          return normalizedEntered === normalizedGeocoded;
        }
        
        // For longer strings, use word boundary matching
        // Split on spaces (already normalized), filter empty
        const words = normalizedGeocoded.split(/\s+/).filter(w => w.length > 0);
        const enteredWords = normalizedEntered.split(/\s+/).filter(w => w.length > 0);
        
        // Check if all significant words from entered appear in geocoded (lenient matching)
        // This handles cases like "Beautheil-Saints" matching "Beautheil" or "Beautheil Saints"
        const allWordsMatch = enteredWords.every(ew => 
          words.some(gw => 
            ew === gw || // Exact word match
            (ew.length >= 4 && gw.startsWith(ew)) || // Prefix match for longer words
            (gw.length >= 4 && ew.startsWith(gw)) || // Reverse prefix match
            (ew.length >= 3 && gw.includes(ew)) || // Substring match for compound names
            (gw.length >= 3 && ew.includes(gw)) // Reverse substring match
          )
        );
        
        // Also check if any significant word matches (for partial matches)
        // For city names, if the first word matches, it's likely correct
        const firstWordMatches = enteredWords.length > 0 && words.length > 0 && 
          (enteredWords[0] === words[0] || 
           (enteredWords[0].length >= 4 && words[0].startsWith(enteredWords[0])) ||
           (words[0].length >= 4 && enteredWords[0].startsWith(words[0])));
        
        const anyWordMatches = enteredWords.some(ew => 
          words.some(gw => 
            ew === gw || 
            (ew.length >= 4 && gw.startsWith(ew)) || 
            (gw.length >= 4 && ew.startsWith(gw))
          )
        );
        
        return (
          allWordsMatch || // All words match (best case)
          (firstWordMatches && enteredWords.length <= 2) || // First word matches for short compound names
          anyWordMatches || // At least one significant word matches
          (normalizedEntered.length >= 4 && normalizedGeocoded.startsWith(normalizedEntered)) || // Prefix match
          (normalizedGeocoded.length >= 4 && normalizedEntered.startsWith(normalizedGeocoded)) // Reverse prefix match
        );
      };
      
      // City validation: must match a geocoded city using strict matching
      // Always check city validation regardless of county match
      const cityFoundInResults = enteredCity && allGeocodedCities.some((gc: string) => 
        strictMatch(enteredCity, gc)
      );
      
      // County validation: use strict matching to prevent partial matches like "S" matching "Seine-et-Marne"
      // Check against all results, not just first one (counties can vary across results)
      const allGeocodedCounties = data.map((r: GeocodeResult) => {
        return [
          r.address?.county,
          r.address?.state,
          r.address?.region,
          r.address?.province
        ].filter(Boolean).map((c: string) => c.toLowerCase());
      }).flat().filter((c: string, index: number, self: string[]) => self.indexOf(c) === index);
      
      const countyMatches = enteredCounty && allGeocodedCounties.some((gc: string) => 
        strictMatch(enteredCounty, gc)
      );
      
      // Country verification: check if entered country matches geocoded country
      // Note: We've already filtered results to the correct country, so this should always match
      // But we keep the check for safety
      const normalizedGeocodedCountry = normalizeEuropeanCountry(geocodedCountry);
      const countryMatches = normalizedEnteredCountry && normalizedGeocodedCountry && 
        normalizedEnteredCountry === normalizedGeocodedCountry;
      
      // City mismatch: flag if city doesn't match
      // However, if county matches, we're more lenient (postcodes can span multiple cities in same county)
      // Only flag as mismatch if BOTH city doesn't match AND county doesn't match
      // This prevents false warnings for valid cities that just aren't in the geocoded results
      // Note: We check allGeocodedCities (all results), not just geocodedCity (first result)
      const cityMismatch = enteredCity && 
        !cityFoundInResults && 
        !countyMatches; // If county matches, don't flag city mismatch (postcodes span multiple cities)
      
      // County mismatch: use strict matching to prevent false positives
      const countyMismatch = enteredCounty && geocodedCounty && !countyMatches;
      
      // Country mismatch: must be exact match after normalization
      // Note: We've already filtered results to the correct country, so this should rarely trigger
      // But we keep the check for safety (e.g., if normalization fails)
      // This is a CRITICAL ERROR - block submission
      const countryMismatch = enteredCountry && geocodedCountry && (
        !normalizedEnteredCountry || // Entered country is not a valid European country
        (normalizedEnteredCountry !== normalizedGeocodedCountry && normalizedGeocodedCountry) // Mismatch when both are valid
      );
      
      // Street validation: use confidence-based matching
      // Remove generic terms before comparison, then check word-by-word
      const genericTerms = new Set(['street', 'st', 'road', 'rd', 'lane', 'ln', 'ave', 'avenue', 'boulevard', 'blvd', 'drive', 'dr', 'way', 'wy', 'court', 'ct', 'circle', 'cir', 'place', 'pl']);
      
      const streetValidation = enteredStreet && geocodedStreet && (() => {
        // Tokenize and remove generic terms, keep only meaningful words (3+ chars)
        const enteredWords = enteredStreet
          .split(/\s+/)
          .map(w => w.toLowerCase().replace(/[.,]/g, ''))
          .filter(w => w.length >= 3 && !genericTerms.has(w));
        
        const geocodedWords = geocodedStreet
          .split(/\s+/)
          .map(w => w.toLowerCase().replace(/[.,]/g, ''))
          .filter(w => w.length >= 3 && !genericTerms.has(w));
        
        // If no meaningful words after filtering, skip validation (too ambiguous)
        if (enteredWords.length === 0 || geocodedWords.length === 0) {
          return { match: false, confidence: 0 }; // Ambiguous, treat as warning
        }
        
        // Count matches with confidence levels
        let matchCount = 0;
        let weakMatchCount = 0;
        
        enteredWords.forEach(ew => {
          geocodedWords.forEach(gw => {
            if (ew === gw) {
              matchCount++; // Exact match
            } else if (ew.length >= 4 && gw.startsWith(ew)) {
              matchCount++; // Strong prefix match
            } else if (gw.length >= 4 && ew.startsWith(gw)) {
              matchCount++; // Strong reverse prefix match
            } else if (ew.length >= 3 && (gw.includes(ew) || ew.includes(gw))) {
              weakMatchCount++; // Weak match (substring)
            }
          });
        });
        
        // Confidence levels:
        // ≥2 meaningful matches → Valid (no warning)
        // 1 weak match → WARNING
        // No matches → WARNING
        if (matchCount >= 2) {
          return { match: true, confidence: matchCount };
        } else if (matchCount === 1 || weakMatchCount >= 1) {
          return { match: false, confidence: 1 }; // Weak match - warning
        } else {
          return { match: false, confidence: 0 }; // No match - warning
        }
      })();
      
      const streetMismatch = streetValidation && !streetValidation.match;

      // Collect warnings (non-critical) and errors (critical)
      // Reasons stored internally only, not displayed to user
      const warnings: string[] = [];
      const errors: string[] = [];

      // Check for obviously invalid entries first (these are ERRORS, not warnings)
      // Return field-specific errors/warnings (reasons stored internally)
      const fieldErrors: {
        street?: string;
        city?: string;
        county?: string;
        postcode?: string;
      } = {};
      const fieldWarnings: {
        street?: string;
        city?: string;
        county?: string;
      } = {};

      // City validation: check for obviously invalid first
      if (enteredCity && isObviouslyInvalid(enteredCity, 'city')) {
        fieldErrors.city = `Invalid city`; // Simple message for display
      } else if (cityMismatch) {
        // City mismatch: only show WARNING if county also doesn't match
        // If county matches, accept city (postcodes can span multiple cities in same county)
        // This prevents false warnings for valid cities like "Beautheil-Saints" when county matches
        if (!countyMatches) {
          fieldWarnings.city = `May not match postcode`; // Simple message for display
        }
        // If county matches, no warning (city is accepted)
      }

      if (enteredCounty && isObviouslyInvalid(enteredCounty, 'county')) {
        fieldErrors.county = `Invalid county`; // Simple message for display
      } else if (countyMismatch) {
        // County mismatch: WARNING (check against county, state, region, province)
        fieldWarnings.county = `May not match postcode`; // Simple message for display
      }

      // Street validation: use confidence-based approach
      if (enteredStreet && isObviouslyInvalid(enteredStreet, 'street')) {
        // Make this a warning, not error, since street numbers can be just digits
        fieldWarnings.street = `Unusual format`; // Simple message for display
      } else if (streetMismatch) {
        // Street mismatch: WARNING (based on confidence levels)
        fieldWarnings.street = `May not match postcode`; // Simple message for display
      }

      // Convert to arrays for backward compatibility with existing code
      if (Object.keys(fieldErrors).length > 0) {
        errors.push(...Object.values(fieldErrors).filter(Boolean) as string[]);
      }
      if (Object.keys(fieldWarnings).length > 0) {
        warnings.push(...Object.values(fieldWarnings).filter(Boolean) as string[]);
      }

      // Country mismatch: ERROR (critical - must match)
      if (countryMismatch) {
        errors.push(`Country "${country}" does not match postcode "${postcode}"`);
      }

      // Return result with field-specific errors/warnings
      const hasErrors = Object.keys(fieldErrors).length > 0;
      
      if (hasErrors) {
        return {
          match: false,
          isError: true, // Critical error - block submission
          error: errors.join("; "), // Keep for backward compatibility
          warnings: warnings,
          fieldErrors: fieldErrors,
          fieldWarnings: fieldWarnings,
          coordinates: {
            lat: parseFloat(result.lat),
            lng: parseFloat(result.lon),
          },
        };
      }

      if (warnings.length > 0 || Object.keys(fieldWarnings).length > 0) {
        return {
          match: true, // Allow submission but with warnings
          isError: false,
          warnings: warnings,
          fieldErrors: {},
          fieldWarnings: fieldWarnings,
          coordinates: {
            lat: parseFloat(result.lat),
            lng: parseFloat(result.lon),
          },
        };
      }

      // Perfect match - no warnings or errors
      return {
        match: true,
        isError: false,
        warnings: [],
        fieldErrors: {},
        fieldWarnings: {},
        coordinates: {
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon),
        },
      };
    } catch (error) {
      log.error("Postcode verification error:", error);
      // On error, allow submission but show warning
      return { 
        match: true, 
        isError: false,
        warnings: ["Could not verify address. Please double-check your entry."],
      };
    }
  }


  const handleSubmitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.name.trim() || !formData.street.trim() || !formData.city.trim() || !formData.postcode.trim()) {
      toast.error("Please fill in all required fields (Site Name, Street, City, Postcode)");
      return;
    }

    // Validate postcode format
    if (!validatePostcode(formData.postcode, formData.country)) {
      toast.error("Please enter a valid postcode for the selected country");
      return;
    }

    // Check if address has critical errors (block submission)
    const hasErrors = Object.keys(fieldErrors).length > 0;
    if (hasErrors) {
      const errorMessages = Object.values(fieldErrors).filter(Boolean);
      toast.error(errorMessages.join("; "));
      return;
    }

    // For clients, clientId is automatically set by backend
    // For admins, clientId must be provided
    if (isAdmin && !formData.clientId) {
      toast.error("Please select a client for this site");
      return;
    }

    // Combine address fields into single address string
    // Always include all 4 parts (even if county is empty) for consistent parsing
    const addressParts = [
      formData.street,
      formData.city,
      formData.county || "", // Include empty county to maintain 4-part format
      formData.country
    ].join(', ');

    // Prepare data for API (combine address fields)
    const createData: CreateSiteRequest = {
      name: formData.name,
      address: addressParts,
      postcode: formData.postcode,
      contactName: formData.contactName || undefined,
      contactPhone: formData.contactPhone || undefined,
      clientId: formData.clientId,
      lat: formData.lat,
      lng: formData.lng,
    };

    // Geocode postcode if coordinates are not set
    if (!createData.lat || !createData.lng) {
      setIsVerifying(true);
      try {
        const coordinates = await geocodePostcode(createData.postcode);
        if (coordinates) {
          createData.lat = coordinates.lat;
          createData.lng = coordinates.lng;
        }
      } catch (error) {
        log.error("Geocoding error:", error);
      } finally {
        setIsVerifying(false);
      }
    }

    try {
      await createSite.mutateAsync(createData);
      toast.success("Site created successfully");
      setIsCreateDialogOpen(false);
      setFormData({
        name: "",
        street: "",
        city: "",
        county: "",
        country: "",
        postcode: "",
        contactName: "",
        contactPhone: "",
        clientId: undefined,
        lat: undefined,
        lng: undefined,
      });
    } catch (error) {
      toast.error("Failed to create site", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.name.trim() || !formData.street.trim() || !formData.city.trim() || !formData.postcode.trim() || !formData.country.trim()) {
      toast.error("Please fill in all required fields (Site Name, Street, City, Postcode, Country)");
      return;
    }

    // Validate postcode format
    if (!validatePostcode(formData.postcode, formData.country)) {
      toast.error("Please enter a valid postcode for the selected country");
      return;
    }

    // Check if address has critical errors (block submission)
    const hasErrors = Object.keys(fieldErrors).length > 0;
    if (hasErrors) {
      const errorMessages = Object.values(fieldErrors).filter(Boolean);
      toast.error(errorMessages.join("; "));
      return;
    }

    if (!selectedSite) return;

    // Combine address fields into single address string
    // Always include all 4 parts (even if county is empty) for consistent parsing
    const addressParts = [
      formData.street,
      formData.city,
      formData.county || "", // Include empty county to maintain 4-part format
      formData.country
    ].join(', ');

    // Geocode postcode if it changed or coordinates are missing
    const updateData: UpdateSiteRequest = {
      name: formData.name,
      address: addressParts,
      postcode: formData.postcode,
      contactName: formData.contactName || undefined,
      contactPhone: formData.contactPhone || undefined,
    };

    const postcodeChanged = selectedSite.postcode !== formData.postcode;
    const needsGeocoding = postcodeChanged || !formData.lat || !formData.lng;

    if (needsGeocoding && (!updateData.lat || !updateData.lng)) {
      setIsVerifying(true);
      try {
        const coordinates = await geocodePostcode(formData.postcode);
        if (coordinates) {
          updateData.lat = coordinates.lat;
          updateData.lng = coordinates.lng;
        }
      } catch (error) {
        log.error("Geocoding error:", error);
      } finally {
        setIsVerifying(false);
      }
    } else if (formData.lat && formData.lng) {
      // Keep existing coordinates if postcode didn't change
      updateData.lat = formData.lat;
      updateData.lng = formData.lng;
    }

    try {
      await updateSite.mutateAsync({ id: selectedSite.id, data: updateData });
      toast.success("Site updated successfully");
      setIsEditDialogOpen(false);
      setSelectedSite(null);
    } catch (error) {
      toast.error("Failed to update site", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedSite) return;

    try {
      await deleteSite.mutateAsync(selectedSite.id);
      toast.success("Site deleted successfully");
      setIsDeleteDialogOpen(false);
      setSelectedSite(null);
    } catch (error) {
      toast.error("Failed to delete site", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  };

  // The error state returns early, but it has to sit BELOW every hook. It used
  // to be declared above the auto-verify `useEffect`, so the hook was skipped
  // whenever the fetch failed — React then saw a different number of hooks
  // between renders, which corrupts the state of every hook after it.
  if (error) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Failed to load sites. Please try refreshing the page.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <p className="flex items-center gap-1.5 text-muted-foreground">
            <span>
              {isAdmin
                ? "Manage all site addresses across clients"
                : "Manage your site addresses"}
            </span>
            <InfoTooltip
              label="Site management help"
              content={
                <div className="space-y-1.5">
                  <p className="font-semibold">Sites</p>
                  <p>
                    Sites are collection and delivery addresses used when creating bookings.
                  </p>
                  <p>
                    Add a verified address with postcode and optional contact details so bookings can be scheduled accurately.
                  </p>
                </div>
              }
            />
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Site
        </Button>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="flex flex-col sm:flex-row gap-4"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, address, postcode, or contact..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        {isAdmin && (
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-full sm:w-[250px]">
              <SelectValue placeholder="All Clients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.organisationName || client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <ViewModeToggle value={viewMode} onChange={setViewMode} className="self-end sm:self-auto" />
      </motion.div>

      {/* Sites List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredSites.length === 0 ? (
        <div className="text-center py-12">
          <MapPin className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No sites found matching your criteria</p>
          {isClient && (
            <p className="text-sm text-muted-foreground mt-2">
              Create your first site address to get started
            </p>
          )}
        </div>
      ) : viewMode === "list" ? (
        <div className="space-y-2">
          {filteredSites.map((site, index) => (
            <motion.div
              key={site.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.03, 0.15) }}
            >
              <Card className="hover:shadow-sm transition-shadow">
                <CardContent className="flex items-center gap-3 py-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <p className="truncate text-sm font-semibold text-foreground">{site.name}</p>
                      {isAdmin && site.client && (
                        <span className="inline-flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                          <Building2 className="h-3 w-3 shrink-0" />
                          <span className="truncate">{site.client.organisationName || site.client.name}</span>
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm text-muted-foreground sm:grid-cols-[minmax(0,1.4fr)_minmax(0,0.55fr)_minmax(0,1fr)]">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                        <span className="truncate" title={site.address}>{site.address}</span>
                      </div>
                      <div className="truncate" title={site.postcode}>{site.postcode}</div>
                      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                        {(site.contactName || site.contactPhone) ? (
                          <>
                            {site.contactName && (
                              <span className="inline-flex min-w-0 max-w-full items-center gap-1 truncate">
                                <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                                <span className="truncate">{site.contactName}</span>
                              </span>
                            )}
                            {site.contactPhone && (
                              <span className="inline-flex min-w-0 max-w-full items-center gap-1 truncate">
                                <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                                <span className="truncate">{site.contactPhone}</span>
                              </span>
                            )}
                          </>
                        ) : (
                          <span>—</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleEdit(site)}
                    >
                      <Edit className="h-4 w-4" />
                      <span className="sr-only">Edit site</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(site)}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete site</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredSites.map((site, index) => (
            <motion.div
              key={site.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="h-full hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-primary flex-shrink-0" />
                        <span className="truncate">{site.name}</span>
                      </CardTitle>
                      {isAdmin && site.client && (
                        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {site.client.organisationName || site.client.name}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1 ml-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(site)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(site)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{site.address}</p>
                    <p className="text-sm text-muted-foreground">{site.postcode}</p>
                  </div>
                  
                  {(site.contactName || site.contactPhone) && (
                    <div className="pt-2 border-t space-y-1">
                      {site.contactName && (
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">{site.contactName}</span>
                        </div>
                      )}
                      {site.contactPhone && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">{site.contactPhone}</span>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <ListPagination
        pagination={pagination}
        onPageChange={setSitesPage}
        onLimitChange={(l) => { setSitesLimit(l); setSitesPage(1); }}
        itemLabel="sites"
        isLoading={isFetching}
      />

      {/* Create Site Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Site</DialogTitle>
            <DialogDescription>
              {isAdmin 
                ? "Create a new site address. Select which client this site belongs to."
                : "Create a new site address for your bookings."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitCreate}>
            <div className="space-y-4 py-4">
              {isAdmin && (
                <div className="space-y-2">
                  <Label htmlFor="clientId">Client *</Label>
                  <Select
                    value={formData.clientId || ""}
                    onValueChange={(value) => setFormData({ ...formData, clientId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.organisationName || client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Select which client this site belongs to
                  </p>
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="name">Site Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Manchester Office"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="street">Street *</Label>
                <Input
                  id="street"
                  placeholder="123 High Street"
                  value={formData.street}
                  onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                  required
                  className={cn(
                    fieldErrors.street && "border-destructive",
                    fieldWarnings.street && "border-amber-500",
                    !fieldErrors.street && !fieldWarnings.street && formData.street && "border-green-500"
                  )}
                />
                <div className="min-h-[14px] -mb-1">
                  {fieldErrors.street && !isVerifying && (
                    <p className="text-xs text-destructive">
                      {fieldErrors.street}
                    </p>
                  )}
                  {fieldWarnings.street && !isVerifying && !fieldErrors.street && (
                    <p className="text-xs text-amber-600 dark:text-amber-500">
                      {fieldWarnings.street}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    placeholder="London"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    required
                    className={cn(
                      fieldErrors.city && "border-destructive",
                      fieldWarnings.city && "border-amber-500",
                      !fieldErrors.city && !fieldWarnings.city && formData.city && "border-green-500"
                    )}
                  />
                  <div className="min-h-[14px] -mb-1">
                    {fieldErrors.city && !isVerifying && (
                      <p className="text-xs text-destructive">
                        {fieldErrors.city}
                      </p>
                    )}
                    {fieldWarnings.city && !isVerifying && !fieldErrors.city && (
                      <p className="text-xs text-amber-600 dark:text-amber-500">
                        {fieldWarnings.city}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="county">County</Label>
                  <Input
                    id="county"
                    placeholder="Greater London"
                    value={formData.county}
                    onChange={(e) => setFormData({ ...formData, county: e.target.value })}
                  />
                  <div className="min-h-[14px] -mb-1">
                    {/* Reserved space for county messages if needed in future */}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="postcode">Postcode *</Label>
                  <div className="relative">
                    <Input
                      id="postcode"
                      placeholder="e.g., M1 1AA"
                      value={formData.postcode}
                      onChange={(e) => setFormData({ ...formData, postcode: e.target.value })}
                      required
                      className={cn(
                        formData.postcode && !validatePostcode(formData.postcode, formData.country) && "border-warning",
                        fieldErrors.postcode && "border-destructive",
                        isValid && !fieldErrors.postcode && "border-green-500",
                        "pr-8"
                      )}
                    />
                    {isVerifying && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    {!isVerifying && isValid && !fieldErrors.postcode && Object.keys(fieldWarnings).length === 0 && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <span className="text-green-600 text-lg">✓</span>
                      </div>
                    )}
                  </div>
                  <div className="min-h-[14px] -mb-1">
                    {fieldErrors.postcode && !isVerifying && (
                      <p className="text-xs text-destructive">
                        {fieldErrors.postcode}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country">Country *</Label>
                  <Input
                    id="country"
                    placeholder="e.g., United Kingdom, Germany, France"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    required
                  />
                  <div className="min-h-[14px]">
                    {/* Reserved space for country messages if needed in future */}
                  </div>
                </div>
              </div>


              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contactName">Contact Name</Label>
                  <Input
                    id="contactName"
                    placeholder="Optional"
                    value={formData.contactName}
                    onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactPhone">Contact Phone</Label>
                  <Input
                    id="contactPhone"
                    placeholder="Optional"
                    value={formData.contactPhone}
                    onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateDialogOpen(false);
                  setFormData({
                    name: "",
                    street: "",
                    city: "",
                    county: "",
                    country: "",
                    postcode: "",
                    contactName: "",
                    contactPhone: "",
                    clientId: undefined,
                    lat: undefined,
                    lng: undefined,
                  });
                  setFieldErrors({});
                  setFieldWarnings({});
                  setIsValid(false);
                }}
                disabled={createSite.isPending}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={
                  createSite.isPending || 
                  isVerifying ||
                  !formData.name.trim() ||
                  !formData.street.trim() ||
                  !formData.city.trim() ||
                  !formData.postcode.trim() ||
                  !formData.country.trim() ||
                  !validatePostcode(formData.postcode, formData.country) ||
                  (isAdmin && !formData.clientId) ||
                  Object.keys(fieldErrors).length > 0 // Block only on critical errors, allow with warnings
                }
              >
                {createSite.isPending || isVerifying ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {isVerifying ? "Verifying..." : "Creating..."}
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Site
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Site Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Site</DialogTitle>
            <DialogDescription>
              Update the site address information.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitEdit}>
            <div className="py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Site Name *</Label>
                <Input
                  id="edit-name"
                  placeholder="e.g., Manchester Office"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-street">Street *</Label>
                <Input
                  id="edit-street"
                  placeholder="123 High Street"
                  value={formData.street}
                  onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                  required
                  className={cn(
                    fieldErrors.street && "border-destructive",
                    fieldWarnings.street && "border-amber-500",
                    !fieldErrors.street && !fieldWarnings.street && formData.street && "border-green-500"
                  )}
                />
                <div className="min-h-[14px] -mb-1">
                  {fieldErrors.street && !isVerifying && (
                    <p className="text-xs text-destructive">
                      {fieldErrors.street}
                    </p>
                  )}
                  {fieldWarnings.street && !isVerifying && !fieldErrors.street && (
                    <p className="text-xs text-amber-600 dark:text-amber-500">
                      {fieldWarnings.street}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-city">City *</Label>
                  <Input
                    id="edit-city"
                    placeholder="London"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    required
                    className={cn(
                      fieldErrors.city && "border-destructive",
                      fieldWarnings.city && "border-amber-500",
                      !fieldErrors.city && !fieldWarnings.city && formData.city && "border-green-500"
                    )}
                  />
                  <div className="min-h-[14px] -mb-1">
                    {fieldErrors.city && !isVerifying && (
                      <p className="text-xs text-destructive">
                        {fieldErrors.city}
                      </p>
                    )}
                    {fieldWarnings.city && !isVerifying && !fieldErrors.city && (
                      <p className="text-xs text-amber-600 dark:text-amber-500">
                        {fieldWarnings.city}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-county">County</Label>
                  <Input
                    id="edit-county"
                    placeholder="Greater London"
                    value={formData.county}
                    onChange={(e) => setFormData({ ...formData, county: e.target.value })}
                    className={cn(
                      fieldErrors.county && "border-destructive",
                      fieldWarnings.county && "border-amber-500",
                      !fieldErrors.county && !fieldWarnings.county && formData.county && "border-green-500"
                    )}
                  />
                  <div className="min-h-[14px] -mb-1">
                    {fieldErrors.county && !isVerifying && (
                      <p className="text-xs text-destructive">
                        {fieldErrors.county}
                      </p>
                    )}
                    {fieldWarnings.county && !isVerifying && !fieldErrors.county && (
                      <p className="text-xs text-amber-600 dark:text-amber-500">
                        {fieldWarnings.county}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-postcode">Postcode *</Label>
                  <div className="relative">
                    <Input
                      id="edit-postcode"
                      placeholder="e.g., M1 1AA"
                      value={formData.postcode}
                      onChange={(e) => setFormData({ ...formData, postcode: e.target.value })}
                      required
                      className={cn(
                        formData.postcode && !validatePostcode(formData.postcode, formData.country) && "border-warning",
                        fieldErrors.postcode && "border-destructive",
                        isValid && !fieldErrors.postcode && "border-green-500",
                        "pr-8"
                      )}
                    />
                    {isVerifying && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    {!isVerifying && isValid && !fieldErrors.postcode && Object.keys(fieldWarnings).length === 0 && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <span className="text-green-600 text-lg">✓</span>
                      </div>
                    )}
                  </div>
                  <div className="min-h-[14px] -mb-1">
                    {fieldErrors.postcode && !isVerifying && (
                      <p className="text-xs text-destructive">
                        {fieldErrors.postcode}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-country">Country *</Label>
                  <Input
                    id="edit-country"
                    placeholder="e.g., United Kingdom, Germany, France"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    required
                  />
                  <div className="min-h-[14px]">
                    {/* Reserved space for country messages if needed in future */}
                  </div>
                </div>
              </div>


              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-contactName">Contact Name</Label>
                  <Input
                    id="edit-contactName"
                    placeholder="Optional"
                    value={formData.contactName}
                    onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-contactPhone">Contact Phone</Label>
                  <Input
                    id="edit-contactPhone"
                    placeholder="Optional"
                    value={formData.contactPhone}
                    onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditDialogOpen(false);
                  setSelectedSite(null);
                  setFieldErrors({});
                  setFieldWarnings({});
                  setIsValid(false);
                }}
                disabled={updateSite.isPending}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={
                  updateSite.isPending || 
                  isVerifying ||
                  !formData.name.trim() ||
                  !formData.street.trim() ||
                  !formData.city.trim() ||
                  !formData.postcode.trim() ||
                  !formData.country.trim() ||
                  !validatePostcode(formData.postcode, formData.country) ||
                  Object.keys(fieldErrors).length > 0 // Block only on critical errors, allow with warnings
                }
              >
                {updateSite.isPending || isVerifying ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {isVerifying ? "Verifying..." : "Updating..."}
                  </>
                ) : (
                  <>
                    <Edit className="h-4 w-4 mr-2" />
                    Update Site
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Site</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedSite?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setSelectedSite(null);
              }}
              disabled={deleteSite.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteSite.isPending}
            >
              {deleteSite.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Sites;
