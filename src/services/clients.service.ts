// Clients Service (for reseller and admin client management)
import type { Client, OrganisationCard } from '@/mocks/mock-entities';
import { ApiError } from './api-error';
import { apiClient } from './api-client';
import type { User } from '@/types/auth';

class ClientsService {
  async getClients(user?: User | null, filter?: { status?: string; resellerId?: string }): Promise<Client[]> {
    const params = new URLSearchParams();
    if (filter?.status) {
      params.append('status', filter.status);
    }
    if (filter?.resellerId) {
      params.append('resellerId', filter.resellerId);
    }

    const queryString = params.toString();
    const endpoint = `/clients${queryString ? `?${queryString}` : ''}`;
    
    const clients = await apiClient.get<Client[]>(endpoint);
    return clients;
  }

  async getOrganisations(search?: string): Promise<OrganisationCard[]> {
    const params = new URLSearchParams();
    if (search?.trim()) {
      params.append('search', search.trim());
    }
    const queryString = params.toString();
    const endpoint = `/clients/organisations${queryString ? `?${queryString}` : ''}`;
    return apiClient.get<OrganisationCard[]>(endpoint);
  }

  async updateTenantDomain(domainId: string, data: { isVerified?: boolean; isPrimary?: boolean }) {
    return apiClient.patch(`/tenant-admin/domains/${domainId}`, data);
  }

  async getClient(id: string): Promise<Client | null> {
    try {
      const client = await apiClient.get<Client>(`/clients/${id}`);
      return client;
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async getClientProfile(): Promise<{ id: string; name: string; email: string; phone: string; organisationName: string; registrationNumber: string; address: string; hasProfile: boolean } | null> {
    try {
      const response = await apiClient.get<{ id: string; name: string; email: string; phone: string; organisationName: string; registrationNumber: string; address: string; hasProfile: boolean }>('/clients/profile/me');
      return response;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async updateClientProfile(data: { name: string; email: string; phone: string; organisationName: string; registrationNumber: string; address: string }): Promise<{ id: string; name: string; email: string; phone: string; organisationName: string; registrationNumber: string; address: string; hasProfile: boolean }> {
    const response = await apiClient.patch<{ id: string; name: string; email: string; phone: string; organisationName: string; registrationNumber: string; address: string; hasProfile: boolean }>('/clients/profile/me', data);
    return response;
  }

  async updateClientStatus(clientId: string, status: 'active' | 'inactive' | 'pending'): Promise<Client> {
    const client = await apiClient.patch<Client>(`/clients/${clientId}/status`, { status });
    return client;
  }
}

export const clientsService = new ClientsService();
