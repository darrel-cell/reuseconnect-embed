import type { AssetCategory } from '@/types/jobs';

export const vehicleEmissions: Record<string, number> = {
  petrol: 0.21,
  diesel: 0.19,
  electric: 0.0,
  car: 0.17,
  van: 0.24,
  truck: 0.89,
};

export const WAREHOUSE_COORDINATES = {
  lat: 51.5174,
  lng: 0.1904,
};

/**
 * Geocode a postcode to get coordinates (using OpenStreetMap Nominatim)
 * Supports all European countries
 */
export async function geocodePostcode(postcode: string): Promise<{ lat: number; lng: number } | null> {
  try {
    // Remove country restriction to support all European countries
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(postcode)}&limit=1`
    );
    const data = await response.json();
    if (data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
      };
    }
  } catch (error) {
    console.error('Geocoding error:', error);
  }
  return null;
}

/**
 * Geocode a postcode or address to get coordinates and full address details
 * Returns coordinates and structured address information including house name/number
 */
export async function geocodeAddressWithDetails(
  query: string
): Promise<{
  coordinates: { lat: number; lng: number } | null;
  address: {
    street?: string;
    city?: string;
    county?: string;
    postcode?: string;
    country?: string;
  } | null;
}> {
  try {
    // Remove country restriction to support all European countries
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&addressdetails=1&extratags=1&namedetails=1`
    );
    const data = await response.json();
    
    if (data.length > 0) {
      const result = data[0];
      const coordinates = {
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
      };

      // Extract address details
      let address: {
        street?: string;
        city?: string;
        county?: string;
        postcode?: string;
        country?: string;
      } | null = null;

      if (result.address) {
        // Extract street - try multiple sources including house name/number
        // Priority: house_name + house_number + road > house_number + road > house_name + road > road > house_number > house_name > fallbacks
        let street = "";
        
        // Get house name from multiple sources
        // Nominatim can store house names in: extratags.house_name, namedetails.name, or address.name
        let houseName = result.extratags?.house_name || 
                       result.namedetails?.name || 
                       result.address?.house_name || 
                       result.address?.name || 
                       "";
        
        // If house name not found in structured fields, try to extract from display_name
        // Nominatim display_name format often starts with house name if present
        // Example: "Oak Cottage, 123 High Street, London, UK"
        if (!houseName && result.display_name) {
          const displayParts = result.display_name.split(',').map(p => p.trim());
          if (displayParts.length > 0) {
            const firstPart = displayParts[0];
            const roadName = result.address?.road || "";
            
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
        
        const houseNumber = result.address.house_number || "";
        const road = result.address.road || "";
        
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
        } else if (result.address.suburb) {
          street = result.address.suburb;
        } else if (result.address.neighbourhood) {
          street = result.address.neighbourhood;
        }

        // Extract city - prioritize actual city/town/village, avoid using road names
        // Check municipality first (common in European addresses like France)
        // Note: 'road' is already declared above
        let city = result.address.city || 
                   result.address.town || 
                   result.address.village || 
                   result.address.municipality || // Common in France and other European countries
                   "";
        
        // Only use locality if it doesn't match the road name (locality can sometimes be the road)
        if (!city) {
          const locality = result.address.locality || "";
          if (locality && locality.toLowerCase() !== road.toLowerCase() && !road.toLowerCase().includes(locality.toLowerCase()) && !locality.toLowerCase().includes(road.toLowerCase())) {
            city = locality;
          }
        }
        
        // Only use suburb/neighbourhood as fallback if they don't match the road name
        // This prevents road names from being used as city names
        if (!city) {
          const suburb = result.address.suburb || "";
          const neighbourhood = result.address.neighbourhood || "";
          
          // Use suburb only if it doesn't match the road name
          if (suburb && suburb.toLowerCase() !== road.toLowerCase() && !road.toLowerCase().includes(suburb.toLowerCase()) && !suburb.toLowerCase().includes(road.toLowerCase())) {
            city = suburb;
          } else if (neighbourhood && neighbourhood.toLowerCase() !== road.toLowerCase() && !road.toLowerCase().includes(neighbourhood.toLowerCase()) && !neighbourhood.toLowerCase().includes(road.toLowerCase())) {
            city = neighbourhood;
          }
        }

        // Extract county
        const county = result.address.county || 
                      result.address.state || 
                      "";

        // Extract postcode
        let postcode = result.address.postcode || "";
        if (!postcode && result.display_name) {
          // Try to extract from display_name if missing - use European patterns
          // Try UK pattern first (most specific), then common European patterns
          const ukPattern = /\b[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}\b/i;
          const commonPatterns = [
            /\b\d{5}\b/, // 5 digits (DE, FR, IT, ES, FI, GR, HR, EE, UA, TR, etc.)
            /\b\d{4}\s?[A-Z]{2}\b/i, // NL format: 1234 AB
            /\b\d{4}\b/, // 4 digits (BE, AT, CH, DK, etc.)
            /\b\d{3}\s?\d{2}\b/, // SE, CZ, SK format: 123 45
            /\b[A-Z]\d{1,2}\s?[A-Z0-9]{4}\b/i, // IE format: D02 AF30
          ];
          
          let postcodeMatch = result.display_name.match(ukPattern);
          if (!postcodeMatch) {
            for (const pattern of commonPatterns) {
              postcodeMatch = result.display_name.match(pattern);
              if (postcodeMatch) break;
            }
          }
          
          if (postcodeMatch) {
            postcode = postcodeMatch[0].replace(/\s+/g, ' ').trim().toUpperCase();
          }
        }

        // Extract country - no default, use what Nominatim returns
        const country = result.address.country || "";

        address = {
          street: street || undefined,
          city: city || undefined,
          county: county || undefined,
          postcode: postcode || undefined,
          country: country || undefined,
        };
      }

      return { coordinates, address };
    }
  } catch (error) {
    console.error('Geocoding error:', error);
  }
  
  return { coordinates: null, address: null };
}

// Import road distance function
import { calculateRoundTripRoadDistance } from './routing';

/**
 * Calculate round trip road distance from collection site to warehouse
 * Uses road distance for accurate calculations
 */
export async function calculateRoundTripDistance(
  collectionLat: number,
  collectionLng: number
): Promise<number> {
  return calculateRoundTripRoadDistance(
    collectionLat,
    collectionLng,
    WAREHOUSE_COORDINATES.lat,
    WAREHOUSE_COORDINATES.lng
  );
}

export function kmToMiles(km: number): number {
  return km * 0.621371;
}



