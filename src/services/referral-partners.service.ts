import { apiClient } from './api-client';

export type ReferralPartnerConfig = {
  id: string;
  slug: string;
  displayName: string;
  websiteUrl?: string | null;
  logoUrl?: string | null;
  partnerUserId?: string | null;
  partnerUserName?: string | null;
  partnerUserEmail?: string | null;
  isActive: boolean;
  canActivate: boolean;
  signupPath: string;
  createdAt: string;
  updatedAt: string;
};

export type ReferralPartnerPublic = {
  slug: string;
  name: string;
  logo?: string | null;
  websiteUrl?: string | null;
  isActive: boolean;
  isReady: boolean;
};

export type ReferralPartnerUserOption = {
  id: string;
  name: string;
  email: string;
  organisationName: string;
};

export type ReferralPartnerInput = {
  slug: string;
  displayName: string;
  websiteUrl?: string | null;
  partnerUserId?: string | null;
  isActive?: boolean;
  clearLogo?: boolean;
};

export const referralPartnersService = {
  list(): Promise<ReferralPartnerConfig[]> {
    return apiClient.get<ReferralPartnerConfig[]>('/referral-partners');
  },

  listPartnerUsers(): Promise<ReferralPartnerUserOption[]> {
    return apiClient.get<ReferralPartnerUserOption[]>('/referral-partners/partner-users');
  },

  getPublic(slug: string): Promise<ReferralPartnerPublic> {
    return apiClient.get<ReferralPartnerPublic>(`/public/referral-partners/${encodeURIComponent(slug)}`);
  },

  getPreview(slug: string): Promise<ReferralPartnerPublic> {
    return apiClient.get<ReferralPartnerPublic>(`/referral-partners/slug/${encodeURIComponent(slug)}/preview`);
  },

  create(data: ReferralPartnerInput): Promise<ReferralPartnerConfig> {
    return apiClient.post<ReferralPartnerConfig>('/referral-partners', data);
  },

  update(id: string, data: Partial<ReferralPartnerInput>): Promise<ReferralPartnerConfig> {
    return apiClient.put<ReferralPartnerConfig>(`/referral-partners/${id}`, data);
  },

  uploadLogo(id: string, file: File): Promise<ReferralPartnerConfig> {
    const formData = new FormData();
    formData.append('logo', file);
    return apiClient.postFormData<ReferralPartnerConfig>(`/referral-partners/${id}/logo`, formData);
  },

  delete(id: string): Promise<{ deleted: boolean }> {
    return apiClient.delete<{ deleted: boolean }>(`/referral-partners/${id}`);
  },
};
