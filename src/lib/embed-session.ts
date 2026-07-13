const AUTH_TOKEN_KEY = 'embed_auth_token';
const PARTNER_KEY = 'embed_partner';

export type EmbedPartnerInfo = {
  slug: string;
  displayName: string;
  logoUrl: string | null;
};

export function getStoredAuthToken(): string | null {
  try {
    return sessionStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredAuthToken(token: string | null) {
  try {
    if (token) {
      sessionStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(AUTH_TOKEN_KEY);
    }
  } catch {
    // ignore storage errors in restricted iframes
  }
}

export function getStoredPartner(): EmbedPartnerInfo | null {
  try {
    const raw = sessionStorage.getItem(PARTNER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as EmbedPartnerInfo;
  } catch {
    return null;
  }
}

export function setStoredPartner(partner: EmbedPartnerInfo | null) {
  try {
    if (partner) {
      sessionStorage.setItem(PARTNER_KEY, JSON.stringify(partner));
    } else {
      sessionStorage.removeItem(PARTNER_KEY);
    }
  } catch {
    // ignore
  }
}

export function clearEmbedSession() {
  setStoredAuthToken(null);
  setStoredPartner(null);
}

export function getParentOrigin(): string | null {
  try {
    if (document.referrer) {
      return new URL(document.referrer).origin;
    }
  } catch {
    // ignore
  }
  return null;
}
