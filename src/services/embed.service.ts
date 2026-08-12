import { API_BASE_URL, apiTunnelHeaders } from '@/lib/config';
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

/** Stable code the API uses when an account may not be opened from the embed. */
export const EMBED_BLOCKED_CODE = 'EMBED_ACCOUNT_UNAVAILABLE';

/**
 * Error that preserves the API's machine-readable `code`.
 *
 * Without it the bootstrap screen can only show prose, and cannot tell an
 * unavailable account apart from an expired link or a network failure — which
 * are three quite different things to say to somebody.
 */
export class EmbedError extends Error {
  constructor(message: string, public code?: string, public status?: number) {
    super(message);
    this.name = 'EmbedError';
  }

  /** True when the account itself cannot be opened, rather than the link. */
  get isAccountUnavailable(): boolean {
    return this.code === EMBED_BLOCKED_CODE;
  }
}

async function parseJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success) {
    throw new EmbedError(
      data?.error || data?.message || 'Request failed',
      data?.code,
      response.status
    );
  }
  return data.data as T;
}

export const embedService = {
  async exchangeToken(token: string, parentOrigin?: string | null): Promise<EmbedExchangeResult> {
    const response = await fetch(`${API_BASE_URL}/embed/exchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...apiTunnelHeaders(),
      },
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
      headers: {
        ...apiTunnelHeaders(),
      },
      credentials: 'include',
    });
    return parseJson<EmbedPartnerPublic>(response);
  },
};
