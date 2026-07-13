// JML Booking Service
import { ApiError, ApiErrorType } from './api-error';
import { apiClient } from './api-client';

export interface NewStarterRequest {
  clientId?: string;
  clientName?: string;
  employeeName: string;
  email: string;
  address: string;
  postcode: string;
  phone: string;
  startDate: string;
  deviceType: 'Windows' | 'Apple' | 'Android';
  siteName: string;
  lat?: number;
  lng?: number;
  charityPercent?: number;
  devices?: Array<{
    category: string;
    make: string;
    model: string;
    quantity: number;
    deviceType: 'Windows' | 'Apple' | 'Android';
    notes?: string;
  }>;
}

export interface LeaverRequest {
  clientId?: string;
  clientName?: string;
  leaverName: string;
  address: string;
  postcode: string;
  personalEmail: string;
  phone: string;
  leavingDate: string;
  siteName: string;
  lat?: number;
  lng?: number;
  devices?: Array<{
    category: string;
    make: string;
    model: string;
    quantity: number;
    deviceType: 'Windows' | 'Apple' | 'Android';
    notes?: string;
  }>;
  charityPercent?: number;
  preferredVehicleType?: 'petrol' | 'diesel' | 'electric';
  assets?: Array<{
    categoryId: string;
    quantity: number;
  }>;
}

export interface BreakfixRequest {
  clientId?: string;
  clientName?: string;
  employeeName: string;
  email: string;
  address: string;
  postcode: string;
  phone: string;
  siteName: string;
  charityPercent?: number;
  // Replacement device requirements (what admin will allocate from inventory)
  devices?: Array<{
    category: string;
    make: string;
    model: string;
    quantity: number;
    deviceType: 'Windows' | 'Apple' | 'Android';
    notes?: string;
  }>;
  // Broken/damaged devices (what admin will receive, then sanitize/grade)
  brokenDevices: Array<{
    category: string;
    make: string;
    model: string;
    quantity: number;
    deviceType: 'Windows' | 'Apple' | 'Android';
    notes?: string;
  }>;
  deviceType: 'Windows' | 'Apple' | 'Android';
  lat?: number;
  lng?: number;
}

export interface MoverRequest {
  clientId?: string;
  clientName?: string;
  employeeName: string;
  email: string;
  address: string; // New address (delivery)
  postcode: string; // New address postcode
  phone: string;
  siteName: string; // New address site name
  scheduledDate: string; // Move date
  charityPercent?: number;
  currentAddress?: string; // Current address (collection) - optional for backward compatibility
  currentPostcode?: string; // Current address postcode
  currentSiteName?: string; // Current address site name
  currentLat?: number; // Current address latitude
  currentLng?: number; // Current address longitude
  currentDevices: Array<{
    category: string;
    make: string;
    model: string;
    quantity: number;
    deviceType: 'Windows' | 'Apple' | 'Android';
    notes?: string;
  }>;
  deviceType?: 'Windows' | 'Apple' | 'Android'; // Optional - removed replacement device section
  lat?: number; // New address latitude
  lng?: number; // New address longitude
}

export interface BookingResponse {
  id: string;
  bookingNumber: string;
  erpJobNumber?: string;
  status: string;
  createdAt: string;
  bookingType: 'itad_collection' | 'free_collection' | 'jml';
  jmlSubType?: 'new_starter' | 'leaver' | 'breakfix' | 'mover';
  employeeName?: string;
  employeeEmail?: string;
  employeePhone?: string;
  startDate?: string;
  deviceType?: string;
  courierTracking?: string;
  deliveryDate?: string;
}

class JMLBookingService {
  async createNewStarter(request: NewStarterRequest): Promise<BookingResponse> {
    const response = await apiClient.post<BookingResponse>('/bookings/jml/new-starter', request);
    return response;
  }

  async createLeaver(request: LeaverRequest): Promise<BookingResponse> {
    const response = await apiClient.post<BookingResponse>('/bookings/jml/leaver', request);
    return response;
  }

  async createBreakfix(request: BreakfixRequest): Promise<BookingResponse> {
    const response = await apiClient.post<BookingResponse>('/bookings/jml/breakfix', request);
    return response;
  }

  async createMover(request: MoverRequest): Promise<BookingResponse> {
    const response = await apiClient.post<BookingResponse>('/bookings/jml/mover', request);
    return response;
  }

  async allocateDevice(
    bookingId: string,
    options: 
      | { serialNumber: string }
      | { category: string; make: string; model: string; deviceType?: string | null; quantity: number }
  ): Promise<{ booking: BookingResponse; allocatedSerialNumbers: string[]; quantity: number }> {
    const response = await apiClient.patch<{ booking: BookingResponse; allocatedSerialNumbers: string[]; quantity: number }>(
      `/bookings/${bookingId}/allocate-device`,
      options
    );
    return response;
  }

  async allocateDeviceBySerial(bookingId: string, serialNumber: string): Promise<{ booking: BookingResponse; allocatedSerialNumbers: string[]; quantity: number }> {
    return this.allocateDevice(bookingId, { serialNumber });
  }

  /** Mover: allocate all inventory rows linked to this booking (mover_allocated + moverSourceBookingId). */
  async allocateMoverAll(
    bookingId: string,
    options?: { advanceBookingStatus?: boolean }
  ): Promise<{
    booking: BookingResponse;
    allocatedSerialNumbers: string[];
    quantity: number;
    allMoverDevicesLinked?: boolean;
    linkedSerialNumbers?: string[];
  }> {
    const body =
      options && typeof options.advanceBookingStatus === 'boolean'
        ? { advanceBookingStatus: options.advanceBookingStatus }
        : {};
    return apiClient.post(
      `/bookings/${bookingId}/allocate-mover-all`,
      body
    );
  }

  /** Mover @ inventory: commit selected serials in one step (matches booking line-item quantities). */
  async commitMoverSelectedDevices(
    bookingId: string,
    serialNumbers: string[]
  ): Promise<{
    booking: BookingResponse;
    allocatedSerialNumbers: string[];
    quantity: number;
  }> {
    return apiClient.post(`/bookings/${bookingId}/mover-commit-devices`, {
      serialNumbers,
    });
  }

  async updateCourierTracking(bookingId: string, trackingNumber: string, courierService: string): Promise<BookingResponse> {
    const response = await apiClient.patch<BookingResponse>(`/bookings/${bookingId}/courier-tracking`, {
      trackingNumber,
      courierService,
    });
    return response;
  }

  async markDelivered(bookingId: string): Promise<BookingResponse> {
    const response = await apiClient.patch<BookingResponse>(`/bookings/${bookingId}/mark-delivered`, {});
    return response;
  }

  async markCollected(
    bookingId: string,
    items: Array<{
      make: string;
      model: string;
      serialNumber: string;
      imei?: string;
      accessories?: string[];
    }>
  ): Promise<BookingResponse> {
    const response = await apiClient.patch<BookingResponse>(`/bookings/${bookingId}/mark-collected`, {
      items,
    });
    return response;
  }
}

export const jmlBookingService = new JMLBookingService();
