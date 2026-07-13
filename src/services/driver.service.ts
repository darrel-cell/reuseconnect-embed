// Driver Service
import type { User } from '@/types/auth';
import { ApiError } from './api-error';
import { API_BASE_URL } from '@/lib/config';
import { apiClient } from './api-client';

export interface Driver {
  id: string;
  name: string;
  email: string;
  phone?: string;
  status: string;
  vehicleId?: string | null; // First vehicle ID (for backward compatibility)
  vehicleReg?: string | null; // First vehicle reg (for backward compatibility)
  vehicleType?: 'van' | 'truck' | 'car' | null; // First vehicle type (for backward compatibility)
  vehicleFuelType?: 'petrol' | 'diesel' | 'electric' | null; // First vehicle fuel type (for backward compatibility)
  vehicles?: Array<{
    id: string;
    vehicleReg: string;
    vehicleType: 'van' | 'truck' | 'car';
    vehicleFuelType: 'petrol' | 'diesel' | 'electric';
  }>; // All vehicles assigned to this driver
  hasVehicle: boolean;
  hasProfile: boolean;
}

export interface DriverProfileRequest {
  userId?: string;
  name?: string;
  email?: string;
  phone?: string;
}

class DriverService {
  async getDrivers(): Promise<Driver[]> {
    const drivers = await apiClient.get<Driver[]>('/drivers');
    return drivers;
  }

  async getDriverById(id: string): Promise<Driver | null> {
    try {
      const driver = await apiClient.get<Driver>(`/drivers/${id}`);
      return driver;
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async createOrUpdateProfile(data: DriverProfileRequest): Promise<any> {
    return apiClient.post('/drivers/profile', data);
  }

  async updateProfile(driverId: string, data: Partial<DriverProfileRequest>): Promise<any> {
    return apiClient.patch(`/drivers/${driverId}/profile`, data);
  }

  async deleteDriver(driverId: string): Promise<void> {
    await apiClient.delete(`/drivers/${driverId}`);
  }

  /**
   * Delete driver profile and user account
   * @param driverId - The ID of the driver to delete
   */
  async deleteProfile(driverId: string): Promise<void> {
    await apiClient.delete(`/drivers/${driverId}/profile`);
  }
}

export const driverService = new DriverService();
