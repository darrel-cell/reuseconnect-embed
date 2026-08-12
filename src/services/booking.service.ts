// Booking Service
import type { Job } from '@/types/jobs';
import type { Booking } from '@/mocks/mock-entities';
import { ApiError, ApiErrorType } from './api-error';
import { apiClient, type Paginated } from './api-client';
import type { User } from '@/types/auth';

export interface BookingListFilter {
  status?: string;
  clientId?: string;
  searchQuery?: string;
  page?: number;
  /** Server caps this at 100. */
  limit?: number;
}

export interface BookingRequest {
  clientId?: string; // For resellers: specify which client this booking is for
  clientName?: string; // Client name (from user's tenant name or selected client)
  siteId?: string;
  siteName: string;
  address: string;
  postcode: string;
  contactName?: string;
  contactPhone?: string;
  scheduledDate: string;
  assets: Array<{
    categoryId: string;
    quantity: number;
  }>;
  charityPercent?: number;
  preferredVehicleType?: 'petrol' | 'diesel' | 'electric'; // Vehicle type selected by client
  bookingType?: 'itad_collection' | 'free_collection' | 'jml';
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface BookingResponse {
  id: string;
  bookingNumber?: string;
  erpJobNumber: string;
  status: string;
  estimatedCO2e: number;
  estimatedBuyback: number;
  createdAt: string;
}

class BookingService {
  async createBooking(request: BookingRequest): Promise<BookingResponse> {
    const payload = {
      clientId: request.clientId,
      clientName: request.clientName,
      siteId: request.siteId,
      siteName: request.siteName,
      address: request.address,
      postcode: request.postcode,
      lat: request.coordinates?.lat,
      lng: request.coordinates?.lng,
      scheduledDate: request.scheduledDate,
      assets: request.assets,
      charityPercent: request.charityPercent || 0,
      preferredVehicleType: request.preferredVehicleType,
      bookingType: request.bookingType,
    };

    const response = await apiClient.post<BookingResponse>('/bookings', payload);
    return response;
  }

  async getBooking(id: string): Promise<Job | null> {
    try {
      const booking = await apiClient.get<Job>(`/bookings/${id}`);
      return booking;
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  private buildBookingQuery(filter?: BookingListFilter): string {
    const params = new URLSearchParams();
    if (filter?.status) params.append('status', filter.status);
    if (filter?.clientId) params.append('clientId', filter.clientId);
    if (filter?.searchQuery) params.append('searchQuery', filter.searchQuery);
    if (filter?.page) params.append('page', String(filter.page));
    if (filter?.limit) params.append('limit', String(filter.limit));
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }

  /**
   * Page of bookings, with the pagination envelope kept.
   *
   * The previous version sent no page/limit and returned only the rows, so the
   * caller received the server default of 20 records with no way to know more
   * existed or to reach them.
   */
  async getBookingsPage(filter?: BookingListFilter): Promise<Paginated<Booking>> {
    return apiClient.getPaginated<Booking>(`/bookings${this.buildBookingQuery(filter)}`);
  }

  async getBookings(user?: User | null, filter?: BookingListFilter): Promise<Booking[]> {
    const { data } = await this.getBookingsPage(filter);
    return data;
  }

  async getBookingById(id: string): Promise<Booking | null> {
    try {
      const booking = await apiClient.get<Booking>(`/bookings/${id}`);
      return booking;
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async assignDriver(bookingId: string, driverId: string, scheduledBy: string, vehicleId?: string): Promise<Booking> {
    const booking = await apiClient.post<Booking>(`/bookings/${bookingId}/assign-driver`, { driverId, vehicleId });
    return booking;
  }

  async completeBooking(bookingId: string, completedBy: string): Promise<Booking> {
    // Use the new /complete endpoint for final approval
    const booking = await apiClient.post<Booking>(`/bookings/${bookingId}/complete`, {});
    return booking;
  }

  async checkJobIdUnique(bookingId: string, erpJobNumber: string): Promise<{ isUnique: boolean; erpJobNumber: string }> {
    const response = await apiClient.get<{ isUnique: boolean; erpJobNumber: string }>(
      `/bookings/${bookingId}/check-job-id?erpJobNumber=${encodeURIComponent(erpJobNumber)}`
    );
    return response;
  }

  async approveBooking(
    bookingId: string,
    erpJobNumber: string,
    notes?: string,
    collectionCost?: number,
    scheduledDate?: string
  ): Promise<Booking> {
    const booking = await apiClient.post<Booking>(`/bookings/${bookingId}/approve`, {
      erpJobNumber,
      notes,
      collectionCost,
      scheduledDate,
    });
    return booking;
  }

  async updateBookingStatus(bookingId: string, status: Booking['status'], notes?: string): Promise<Booking> {
    const booking = await apiClient.patch<Booking>(`/bookings/${bookingId}/status`, { status, notes });
    return booking;
  }

  async updateScheduledDate(bookingId: string, scheduledDate: string): Promise<Booking> {
    const booking = await apiClient.patch<Booking>(`/bookings/${bookingId}/scheduled-date`, {
      scheduledDate,
    });
    return booking;
  }

  async deleteBooking(bookingId: string, reason: string): Promise<void> {
    await apiClient.delete(`/bookings/${bookingId}`, { reason });
  }

  async updateBookingAssets(
    bookingId: string,
    assets: Array<
      | { assetId: string; quantity: number }
      | { categoryId: string; quantity: number }
    >,
    reason?: string
  ): Promise<Booking> {
    return apiClient.patch<Booking>(`/bookings/${bookingId}/assets`, { assets, reason });
  }

  async updateErpJobNumber(
    bookingId: string,
    erpJobNumber: string,
    reason?: string
  ): Promise<Booking> {
    return apiClient.patch<Booking>(`/bookings/${bookingId}/erp-job-number`, {
      erpJobNumber,
      reason,
    });
  }
}

export const bookingService = new BookingService();
