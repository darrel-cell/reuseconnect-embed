import { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import { MapPin, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix for default marker icon in React/Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface MapPickerProps {
  position: { lat: number; lng: number } | null;
  onPositionChange: (position: { lat: number; lng: number } | null) => void;
  onAddressChange?: (address: string) => void;
  onAddressDetailsChange?: (details: {
    street?: string;
    city?: string;
    county?: string;
    postcode?: string;
    country?: string;
  }) => void;
  height?: string;
}

interface GeocodeResult {
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    road?: string;
    house_number?: string;
    house_name?: string;
    city?: string;
    town?: string;
    village?: string;
    suburb?: string;
    neighbourhood?: string;
    locality?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
  extratags?: {
    house_name?: string;
  };
}

// Component to handle map clicks and reverse geocoding
function MapClickHandler({
  onPositionChange,
  onAddressChange,
  onAddressDetailsChange,
}: {
  onPositionChange: (position: { lat: number; lng: number }) => void;
  onAddressChange?: (address: string) => void;
  onAddressDetailsChange?: (details: {
    street?: string;
    city?: string;
    county?: string;
    postcode?: string;
    country?: string;
  }) => void;
}) {
  const [isGeocoding, setIsGeocoding] = useState(false);

  useMapEvents({
    click: async (e) => {
      const newPosition = { lat: e.latlng.lat, lng: e.latlng.lng };
      onPositionChange(newPosition);

      // Reverse geocoding
      if (onAddressChange || onAddressDetailsChange) {
        setIsGeocoding(true);
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${newPosition.lat}&lon=${newPosition.lng}&zoom=18&addressdetails=1&extratags=1&namedetails=1`
          );
          const data = await response.json();
          
          // Debug: Log the response to see what fields are available
          // console.log('Nominatim response:', JSON.stringify(data, null, 2));
          if (data.display_name && onAddressChange) {
            onAddressChange(data.display_name);
          }
          if (data.address && onAddressDetailsChange) {
            // Extract street - try multiple sources including house name/number
            // Priority: house_name + house_number + road > house_number + road > house_name + road > road > house_number > house_name > fallbacks
            let street = "";
            
            // Get house name from multiple sources
            // Nominatim can store house names in: extratags.house_name, namedetails.name, or address.name
            let houseName = data.extratags?.house_name || 
                          data.namedetails?.name || 
                          data.address?.house_name || 
                          data.address?.name || 
                          "";
            
            // If house name not found in structured fields, try to extract from display_name
            // Nominatim display_name format often starts with house name if present
            // Example: "Oak Cottage, 123 High Street, London, UK"
            if (!houseName && data.display_name) {
              const displayParts = data.display_name.split(',').map(p => p.trim());
              if (displayParts.length > 0) {
                const firstPart = displayParts[0];
                const roadName = data.address?.road || "";
                
                // Check if first part is likely a house name
                // Criteria: not a number, not the road name, not a common road type, reasonable length
                const roadTypes = ['Street', 'Road', 'Avenue', 'Lane', 'Drive', 'Close', 'Way', 'Place', 'Crescent', 'Grove', 'Terrace', 'Gardens'];
                const isRoadType = roadTypes.some(type => firstPart.toLowerCase().includes(type.toLowerCase()));
                const isNumber = /^\d+[A-Za-z]?$/.test(firstPart); // Matches "123" or "123A"
                const isRoadName = roadName && (firstPart.toLowerCase() === roadName.toLowerCase() || firstPart.toLowerCase().includes(roadName.toLowerCase()));
                
                // If first part looks like a house name (not number, not road type, not road name)
                if (!isNumber && !isRoadType && !isRoadName && firstPart.length > 2 && firstPart.length < 50) {
                  // Additional validation: house names usually don't contain postcodes or city names
                  const hasPostcode = /\b[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}\b/i.test(firstPart);
                  if (!hasPostcode) {
                    houseName = firstPart;
                  }
                }
              }
            }
            
            const houseNumber = data.address.house_number || "";
            const road = data.address.road || "";
            
            // Build street address with priority order
            if (houseName && houseNumber && road) {
              // "Oak Cottage, 123 High Street"
              street = `${houseName}, ${houseNumber} ${road}`.trim();
            } else if (houseNumber && road) {
              // "123 High Street"
              street = `${houseNumber} ${road}`.trim();
            } else if (houseName && road) {
              // "Oak Cottage, High Street"
              street = `${houseName}, ${road}`.trim();
            } else if (road) {
              // "High Street"
              street = road;
            } else if (houseNumber) {
              // Just house number
              street = houseNumber;
            } else if (houseName) {
              // Just house name
              street = houseName;
            } else if (data.address.suburb) {
              // Fallback: use suburb if no road name
              street = data.address.suburb;
            } else if (data.address.neighbourhood) {
              // Fallback: use neighbourhood if no road name
              street = data.address.neighbourhood;
            }

            // Extract city - prioritize actual city/town/village, avoid using road names
            // Check municipality first (common in European addresses like France)
            // Note: 'road' is already declared above
            let city = data.address.city || 
                       data.address.town || 
                       data.address.village || 
                       data.address.municipality || // Common in France and other European countries
                       "";
            
            // Only use locality if it doesn't match the road name (locality can sometimes be the road)
            if (!city) {
              const locality = data.address.locality || "";
              if (locality && locality.toLowerCase() !== road.toLowerCase() && !road.toLowerCase().includes(locality.toLowerCase()) && !locality.toLowerCase().includes(road.toLowerCase())) {
                city = locality;
              }
            }
            
            // Only use suburb/neighbourhood as fallback if they don't match the road name
            // This prevents road names from being used as city names
            if (!city) {
              const suburb = data.address.suburb || "";
              const neighbourhood = data.address.neighbourhood || "";
              
              // Use suburb only if it doesn't match the road name
              if (suburb && suburb.toLowerCase() !== road.toLowerCase() && !road.toLowerCase().includes(suburb.toLowerCase()) && !suburb.toLowerCase().includes(road.toLowerCase())) {
                city = suburb;
              } else if (neighbourhood && neighbourhood.toLowerCase() !== road.toLowerCase() && !road.toLowerCase().includes(neighbourhood.toLowerCase()) && !neighbourhood.toLowerCase().includes(road.toLowerCase())) {
                city = neighbourhood;
              }
            }

            // Extract county
            const county = data.address.county || 
                          data.address.state || 
                          "";

            // Extract postcode - critical for delivery
            let postcode = data.address.postcode || "";
            
            // If postcode is missing, try to extract from display_name using European patterns
            if (!postcode && data.display_name) {
              // Try UK pattern first (most specific), then common European patterns
              const ukPattern = /\b[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}\b/i;
              const commonPatterns = [
                /\b\d{5}\b/, // 5 digits (DE, FR, IT, ES, FI, GR, HR, EE, UA, TR, etc.)
                /\b\d{4}\s?[A-Z]{2}\b/i, // NL format: 1234 AB
                /\b\d{4}\b/, // 4 digits (BE, AT, CH, DK, etc.)
                /\b\d{3}\s?\d{2}\b/, // SE, CZ, SK format: 123 45
                /\b[A-Z]\d{1,2}\s?[A-Z0-9]{4}\b/i, // IE format: D02 AF30
              ];
              
              let postcodeMatch = data.display_name.match(ukPattern);
              if (!postcodeMatch) {
                for (const pattern of commonPatterns) {
                  postcodeMatch = data.display_name.match(pattern);
                  if (postcodeMatch) break;
                }
              }
              
              if (postcodeMatch) {
                postcode = postcodeMatch[0].replace(/\s+/g, ' ').trim().toUpperCase();
              }
            }

            // Extract country - no default, use what Nominatim returns
            const country = data.address.country || "";

            onAddressDetailsChange({
              street: street,
              city: city,
              county: county,
              postcode: postcode,
              country: country,
            });
          }
        } catch (error) {
          console.error("Reverse geocoding error:", error);
        } finally {
          setIsGeocoding(false);
        }
      }
    },
  });

  return null;
}

// Component to update map center when position changes
function MapCenterUpdater({ position }: { position: { lat: number; lng: number } | null }) {
  const map = useMap();
  
  useEffect(() => {
    if (position) {
      map.setView([position.lat, position.lng], 15);
    }
  }, [position, map]);

  return null;
}

export function MapPicker({
  position,
  onPositionChange,
  onAddressChange,
  onAddressDetailsChange,
  height = "400px",
}: MapPickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const defaultCenter: [number, number] = [51.5074, -0.1278]; // London default

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced search for autocomplete
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5&addressdetails=1`
        );
        const data = await response.json();
        setSuggestions(data);
        if (data.length > 0) {
          setShowSuggestions(true);
        }
      } catch (error) {
        console.error("Geocoding error:", error);
      } finally {
        setIsSearching(false);
      }
    }, 500);
  }, [searchQuery]);

  const handleSelectSuggestion = async (suggestion: GeocodeResult) => {
    setSearchQuery(suggestion.display_name);
    setShowSuggestions(false);
    const newPosition = {
      lat: parseFloat(suggestion.lat),
      lng: parseFloat(suggestion.lon),
    };
    onPositionChange(newPosition);
    if (onAddressChange) {
      onAddressChange(suggestion.display_name);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1&addressdetails=1`
      );
      const data = await response.json();

      if (data.length > 0) {
        const result = data[0];
        const newPosition = {
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon),
        };
        onPositionChange(newPosition);
        if (onAddressChange) {
          onAddressChange(result.display_name);
        }
        setSearchQuery(result.display_name);
      }
    } catch (error) {
      console.error("Geocoding error:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const currentCenter: [number, number] = position
    ? [position.lat, position.lng]
    : defaultCenter;

  return (
    <div className="space-y-3">
      {/* Search Bar with Autocomplete */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
            <Input
              placeholder="Search for an address or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSearch();
                }
              }}
              className="pl-9"
            />
          </div>
          <Button
            onClick={handleSearch}
            disabled={isSearching || !searchQuery.trim()}
            type="button"
          >
            {isSearching ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Search className="h-4 w-4 mr-2" />
            )}
            {isSearching ? "Searching..." : "Search"}
          </Button>
        </div>

        {/* Autocomplete Suggestions */}
        {showSuggestions && suggestions.length > 0 && (
          <div 
            ref={suggestionsRef}
            className="absolute z-[2000] w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-60 overflow-auto"
          >
            {suggestions.map((suggestion, index) => (
              <div
                key={index}
                className="px-4 py-2 hover:bg-secondary cursor-pointer transition-colors"
                onClick={() => handleSelectSuggestion(suggestion)}
              >
                <p className="text-sm font-medium">{suggestion.display_name}</p>
                {suggestion.address && (
                  <p className="text-xs text-muted-foreground">
                    {suggestion.address.road && `${suggestion.address.road}, `}
                    {suggestion.address.city && `${suggestion.address.city}, `}
                    {suggestion.address.postcode}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Map */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div style={{ height, width: "100%", position: "relative" }}>
            {isGeocoding && (
              <div className="absolute top-2 right-2 z-[1000] bg-card border border-border rounded-lg px-3 py-2 shadow-lg flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm">Getting address...</span>
              </div>
            )}
            <MapContainer
              center={currentCenter}
              zoom={position ? 15 : 10}
              style={{ height: "100%", width: "100%" }}
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapClickHandler 
                onPositionChange={onPositionChange} 
                onAddressChange={onAddressChange}
                onAddressDetailsChange={onAddressDetailsChange}
              />
              <MapCenterUpdater position={position} />
              {position && (
                <Marker position={[position.lat, position.lng]} />
              )}
            </MapContainer>
          </div>
        </CardContent>
      </Card>

      {/* Position Info */}
      {position && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span>
            {position.lat.toFixed(6)}, {position.lng.toFixed(6)}
          </span>
        </div>
      )}

      {!position && (
        <p className="text-sm text-muted-foreground text-center">
          Click on the map or search for an address to select a location
        </p>
      )}
    </div>
  );
}
