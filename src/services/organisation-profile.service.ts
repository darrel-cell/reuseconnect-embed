// Organisation Profile Service

import { apiClient } from './api-client';

export interface OrganisationProfile {
  id: string;
  userId: string;
  organisationName: string;
  registrationNumber: string;
  address: string;
  email: string;
  phone: string;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

export interface OrganisationProfileData {
  name: string;
  organisationName: string;
  registrationNumber: string;
  address: string;
  email: string;
  phone: string;
}

class OrganisationProfileService {
  async getProfile(): Promise<OrganisationProfile | null> {
    try {
      const response = await apiClient.get<OrganisationProfile>('/organisation-profile');
      return response || null;
    } catch (error) {
      // If API call fails (e.g., 404 - no profile exists), return null
      // This is expected for users who haven't created a profile yet
      console.error('Failed to get organisation profile:', error);
      return null;
    }
  }

  async upsertProfile(data: OrganisationProfileData): Promise<OrganisationProfile> {
    return apiClient.patch<OrganisationProfile>('/organisation-profile', data);
  }

  async checkProfileComplete(): Promise<boolean> {
    try {
      const response = await apiClient.get<{ isComplete: boolean }>('/organisation-profile/complete');
      return response?.isComplete || false;
    } catch (error) {
      // If API call fails, return false (profile not complete)
      // This prevents blocking the page load
      console.error('Failed to check organisation profile completeness:', error);
      return false;
    }
  }
}

export const organisationProfileService = new OrganisationProfileService();

