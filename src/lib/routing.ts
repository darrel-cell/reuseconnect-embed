// Road distance calculation using routing APIs (client-side)
// Falls back to straight-line distance with multiplier if routing API is unavailable

/**
 * Calculate road distance using OSRM (Open Source Routing Machine) public API
 * This is free and doesn't require an API key, but has rate limits
 */
async function calculateRoadDistanceOSRM(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): Promise<number | null> {
  try {
    // OSRM public demo uses HTTP (router.project-osrm.org doesn't support HTTPS)
    const url = `http://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    // OSRM returns distance in meters
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const distanceMeters = data.routes[0].distance;
      return distanceMeters / 1000; // Convert to kilometers
    }

    return null;
  } catch (error) {
    console.warn('OSRM routing API error:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

/**
 * Calculate straight-line distance using Haversine formula (fallback)
 */
function calculateStraightLineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate road distance between two coordinates
 * Tries routing API first, falls back to estimated road distance if unavailable
 * 
 * @param lat1 - Latitude of first point
 * @param lon1 - Longitude of first point
 * @param lat2 - Latitude of second point
 * @param lon2 - Longitude of second point
 * @returns Distance in kilometers
 */
export async function calculateRoadDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): Promise<number> {
  // Try OSRM public API (free, no API key needed)
  const distance = await calculateRoadDistanceOSRM(lat1, lon1, lat2, lon2);
  if (distance !== null) {
    return distance;
  }

  // Fallback to straight-line distance with a multiplier to approximate road distance
  // Road distance is typically 1.2-1.5x straight-line distance in urban areas
  const straightDistance = calculateStraightLineDistance(lat1, lon1, lat2, lon2);
  const estimatedRoadDistance = straightDistance * 1.3; // 30% increase as approximation
  
  console.warn(
    `Routing API unavailable, using estimated road distance (${estimatedRoadDistance.toFixed(2)}km) ` +
    `based on straight-line distance (${straightDistance.toFixed(2)}km)`
  );
  
  return estimatedRoadDistance;
}

/**
 * Calculate round trip road distance from collection site to warehouse
 */
export async function calculateRoundTripRoadDistance(
  collectionLat: number,
  collectionLng: number,
  warehouseLat: number,
  warehouseLng: number
): Promise<number> {
  const oneWay = await calculateRoadDistance(
    collectionLat,
    collectionLng,
    warehouseLat,
    warehouseLng
  );
  
  // Round trip is simply double the one-way distance
  return oneWay * 2;
}
