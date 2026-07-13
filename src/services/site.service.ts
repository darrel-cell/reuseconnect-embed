// Site Service
import { apiClient } from './api-client';

export interface Site {
  id: string;
  clientId: string;
  tenantId: string;
  name: string;
  address: string;
  postcode: string;
  lat?: number;
  lng?: number;
  contactName?: string;
  contactPhone?: string;
  createdAt: string;
  updatedAt: string;
  client?: {
    id: string;
    name: string;
    organisationName?: string;
  };
}

export interface CreateSiteRequest {
  name: string;
  address: string;
  postcode: string;
  lat?: number;
  lng?: number;
  contactName?: string;
  contactPhone?: string;
  clientId?: string; // Optional - for admin/reseller
}

export interface UpdateSiteRequest {
  name?: string;
  address?: string;
  postcode?: string;
  lat?: number;
  lng?: number;
  contactName?: string;
  contactPhone?: string;
}

class SiteService {
  async getSites(clientId?: string): Promise<Site[]> {
    const params = new URLSearchParams();
    if (clientId) {
      params.append('clientId', clientId);
    }
    const queryString = params.toString();
    const response = await apiClient.get<Site[]>(`/sites${queryString ? `?${queryString}` : ''}`);
    return response;
  }

  async getSite(id: string): Promise<Site> {
    const response = await apiClient.get<Site>(`/sites/${id}`);
    return response;
  }

  async createSite(data: CreateSiteRequest): Promise<Site> {
    const response = await apiClient.post<Site>('/sites', data);
    return response;
  }

  async updateSite(id: string, data: UpdateSiteRequest): Promise<Site> {
    const response = await apiClient.put<Site>(`/sites/${id}`, data);
    return response;
  }

  async deleteSite(id: string): Promise<void> {
    await apiClient.delete(`/sites/${id}`);
  }
}

export const siteService = new SiteService();
