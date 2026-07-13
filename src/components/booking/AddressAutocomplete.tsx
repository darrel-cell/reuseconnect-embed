import { useState, useEffect, useRef } from "react";
import { Search, Loader2, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (result: {
    street?: string;
    city?: string;
    county?: string;
    postcode?: string;
    country?: string;
    fullAddress: string;
    coordinates?: { lat: number; lng: number };
  }) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

interface GeocodeResult {
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    road?: string;
    house_number?: string;
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
}

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Enter address...",
  disabled = false,
  className,
  id,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
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

    // Only search if input is focused
    if (!isFocused || value.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            value
          )}&limit=5&addressdetails=1`
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
  }, [value, isFocused]);

  const handleSelectSuggestion = (suggestion: GeocodeResult) => {
    const displayAddress = suggestion.display_name;
    onChange(displayAddress);
    setShowSuggestions(false);

    if (onSelect) {
      onSelect({
        street: suggestion.address?.road || "",
        city: suggestion.address?.city || "",
        county: suggestion.address?.state || suggestion.address?.county || "",
        postcode: suggestion.address?.postcode || "",
        country: suggestion.address?.country || "",
        fullAddress: displayAddress,
        coordinates: {
          lat: parseFloat(suggestion.lat),
          lng: parseFloat(suggestion.lon),
        },
      });
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            setIsFocused(true);
            if (suggestions.length > 0) setShowSuggestions(true);
          }}
          onBlur={() => {
            // Delay to allow click on suggestions
            setTimeout(() => setIsFocused(false), 200);
          }}
          placeholder={placeholder}
          disabled={disabled}
          className={cn("pr-8", className)}
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Autocomplete Suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-60 overflow-auto"
        >
          {suggestions.map((suggestion, index) => (
            <div
              key={index}
              className="px-4 py-3 hover:bg-secondary cursor-pointer transition-colors border-b last:border-b-0"
              onClick={() => handleSelectSuggestion(suggestion)}
            >
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {suggestion.address?.road || suggestion.display_name.split(",")[0]}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {suggestion.display_name}
                  </p>
                  {suggestion.address?.postcode && (
                    <p className="text-xs text-primary mt-1">
                      {suggestion.address.postcode}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

