import { API_BASE_URL } from '@/lib/config';
import type { User } from '@/types/auth';
import type { EmbedPartnerInfo } from '@/lib/embed-session';

export type EmbedExchangeResult = {
  token: string;
  csrfToken?: string;
  user: User;
  partner: EmbedPartnerInfo;
};

export type EmbedPartnerPublic = {
  slug: string;
  displayName: string;
  logoUrl: string | null;
  websiteUrl: string | null;
};

async function parseJson<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || data.message || 'Request failed');
  }
  return data.data as T;
}

export const embedService = {
  async exchangeToken(token: string, parentOrigin?: string | null): Promise<EmbedExchangeResult> {
    const response = await fetch(`${API_BASE_URL}/embed/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        token,
        parentOrigin: parentOrigin || undefined,
      }),
    });
    return parseJson<EmbedExchangeResult>(response);
  },

  async getPartner(slug: string): Promise<EmbedPartnerPublic> {
    const response = await fetch(`${API_BASE_URL}/embed/partners/${encodeURIComponent(slug)}`, {
      method: 'GET',
      credentials: 'include',
    });
    return parseJson<EmbedPartnerPublic>(response);
  },
};
