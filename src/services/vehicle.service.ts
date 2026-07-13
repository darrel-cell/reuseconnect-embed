// Vehicle Service

import { apiClient } from './api-client';

export interface Vehicle {
  id: string;
  tenantId: string;
  vehicleReg: string;
  vehicleType: 'van' | 'truck' | 'car';
  vehicleFuelType: 'petrol' | 'diesel' | 'electric';
  drivers?: Array<{
    id: string;
    driverId: string;
    vehicleId: string;
    driver: {
      id: string;
      name: string;
      email: string;
      status: string;
    };
  }>;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  creator?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface CreateVehicleData {
  vehicleReg: string;
  vehicleType: 'van' | 'truck' | 'car';
  vehicleFuelType: 'petrol' | 'diesel' | 'electric';
}

export interface UpdateVehicleData {
  vehicleReg?: string;
  vehicleType?: 'van' | 'truck' | 'car';
  vehicleFuelType?: 'petrol' | 'diesel' | 'electric';
}

class VehicleService {
  async getVehicles(): Promise<Vehicle[]> {
    const response = await apiClient.get<Vehicle[]>('/vehicles');
    return response || [];
  }

  async getVehicleById(id: string): Promise<Vehicle> {
    const response = await apiClient.get<Vehicle>(`/vehicles/${id}`);
    return response;
  }

  async getVehicleByDriver(driverId: string): Promise<Vehicle[]> {
    const response = await apiClient.get<Vehicle[]>(`/vehicles/driver/${driverId}`);
    return response || [];
  }

  async createVehicle(data: CreateVehicleData): Promise<Vehicle> {
    const response = await apiClient.post<Vehicle>('/vehicles', data);
    return response;
  }

  async updateVehicle(id: string, data: UpdateVehicleData): Promise<Vehicle> {
    const response = await apiClient.patch<Vehicle>(`/vehicles/${id}`, data);
    return response;
  }

  async allocateVehicle(vehicleId: string, driverId: string | null): Promise<Vehicle> {
    const response = await apiClient.post<Vehicle>(`/vehicles/${vehicleId}/allocate`, {
      driverId,
    });
    return response;
  }

  async removeDriverFromVehicle(vehicleId: string, driverId: string): Promise<Vehicle> {
    const response = await apiClient.delete<Vehicle>(`/vehicles/${vehicleId}/drivers/${driverId}`);
    return response;
  }

  async deleteVehicle(id: string): Promise<void> {
    await apiClient.delete(`/vehicles/${id}`);
  }
}

export const vehicleService = new VehicleService();
