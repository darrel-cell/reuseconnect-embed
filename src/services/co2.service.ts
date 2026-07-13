// CO₂ Calculation Service
import { apiClient } from './api-client';

export interface CO2CalculationRequest {
  assets: Array<{
    categoryId: string;
    quantity: number;
    // Used to enforce accessory rules even if category mapping/name in DB differs.
    isAccessory?: boolean;
  }>;
  distanceKm?: number;
  vehicleType?: 'car' | 'van' | 'truck' | 'petrol' | 'diesel' | 'electric';
  collectionCoordinates?: {
    lat: number;
    lng: number;
  };
}

export interface CO2CalculationResponse {
  reuseSavings: number; // kg CO2e
  travelEmissions: number; // kg CO2e (for selected/default vehicle type)
  netImpact: number; // kg CO2e
  distanceKm: number; // Total round trip distance
  distanceMiles: number; // Total round trip distance in miles
  vehicleEmissions: {
    petrol: number; // kg CO2e
    diesel: number; // kg CO2e
    electric: number; // kg CO2e
  };
  equivalencies: {
    treesPlanted: number;
    householdDays: number;
    carMiles: number;
    flightHours: number;
  };
}

export interface SerialStatItem {
  serialNumber: string;
  reuseCount: number;
  totalCO2eSaved: number;
  firstUseDate: string;
  lastUseDate: string;
  averageCO2ePerReuse: number;
  category?: string | null;
  deviceType?: string | null;
  make?: string | null;
  model?: string | null;
}

export interface BookingSerialStatsResponse {
  bookingId: string;
  totalSerials: number;
  totalCO2eSaved: number;
  serials: Array<{
    serialNumber: string;
    reuseCount: number;
    totalCO2eSaved: number;
    allocations: number;
    firstUseDate: string;
    lastUseDate: string;
    averageCO2ePerAllocation: number;
  }>;
}

export interface SerialDetailResponse {
  serialNumber: string;
  clientId: string;
  summary: {
    totalCO2e: number;
    reuseCount: number;
    averageCO2ePerReuse: number;
    firstUseDate: string | null;
    lastUseDate: string | null;
  };
  history: Array<{
    id: string;
    bookingId: string;
    jobId?: string | null;
    serialNumber: string;
    reuseCount: number;
    co2eSaved: number;
    allocatedDate: string;
    returnedDate?: string | null;
  }>;
}

// CO2e equivalencies
const co2eEquivalencies = {
  treesPlanted: (kg: number) => Math.round(kg / 21), // 1 tree absorbs ~21kg CO2/year
  householdDays: (kg: number) => Math.round(kg / 27), // UK household ~27kg CO2/day
  carMiles: (kg: number) => Math.round(kg / 0.21), // ~0.21kg CO2 per mile
  flightHours: (kg: number) => Math.round(kg / 250), // ~250kg CO2 per flight hour
};

class CO2Service {
  async calculateCO2e(request: CO2CalculationRequest): Promise<CO2CalculationResponse> {
    const payload: any = {
      assets: request.assets,
    };

    // Add optional fields if provided
    if (request.distanceKm !== undefined) {
      payload.distanceKm = request.distanceKm;
    }
    if (request.collectionCoordinates) {
      payload.collectionLat = request.collectionCoordinates.lat;
      payload.collectionLng = request.collectionCoordinates.lng;
    }
    if (request.vehicleType) {
      payload.vehicleType = request.vehicleType;
    }

    const response = await apiClient.post<CO2CalculationResponse>('/co2/calculate', payload);
    return response;
  }

  async getJobCO2e(jobId: string): Promise<CO2CalculationResponse | null> {
    try {
      const response = await apiClient.get<CO2CalculationResponse>(`/co2/job/${jobId}`);
      return response;
    } catch (error) {
      console.error('Failed to fetch CO₂e data for job:', error);
      return null;
    }
  }

  async getTenantSerialStats(): Promise<SerialStatItem[]> {
    return apiClient.get<SerialStatItem[]>('/co2/serial-stats');
  }

  async getSerialStats(serialNumber: string, clientId: string): Promise<SerialDetailResponse> {
    const encodedSerial = encodeURIComponent(serialNumber);
    const encodedClient = encodeURIComponent(clientId);
    return apiClient.get<SerialDetailResponse>(`/co2/serial-stats/${encodedSerial}?clientId=${encodedClient}`);
  }

  async getBookingSerialStats(bookingId: string): Promise<BookingSerialStatsResponse> {
    const encodedBookingId = encodeURIComponent(bookingId);
    return apiClient.get<BookingSerialStatsResponse>(`/co2/booking/${encodedBookingId}/serial-stats`);
  }
}

export const co2Service = new CO2Service();

