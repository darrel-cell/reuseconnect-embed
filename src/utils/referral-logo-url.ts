import { API_BASE_URL } from '@/lib/config';

function getApiOrigin() {
  return API_BASE_URL.replace(/\/api\/?$/, '');
}

function extractReferralLogoS3Key(logoUrl: string): string | null {
  if (logoUrl.startsWith('referral-logos/')) {
    return logoUrl;
  }
  if (!logoUrl.startsWith('http://') && !logoUrl.startsWith('https://')) {
    return null;
  }
  try {
    const pathname = new URL(logoUrl).pathname.replace(/^\//, '');
    const idx = pathname.indexOf('referral-logos/');
    if (idx >= 0) {
      return pathname.substring(idx);
    }
  } catch {
    // ignore invalid URLs
  }
  return null;
}

function getReferralLogoS3ProxyUrl(s3Key: string): string {
  const encodedKey = btoa(s3Key).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  return `${getApiOrigin()}/api/public/referral-logos/s3/${encodedKey}`;
}

export function getReferralLogoUrl(logoUrl?: string | null): string | null {
  if (!logoUrl) return null;

  const s3Key = extractReferralLogoS3Key(logoUrl);
  if (s3Key) {
    return getReferralLogoS3ProxyUrl(s3Key);
  }
  if (logoUrl.startsWith('/public/referral-logos/')) {
    return `${getApiOrigin()}/api${logoUrl}`;
  }
  if (logoUrl.startsWith('/partner-logos/')) {
    return logoUrl;
  }
  if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
    return logoUrl;
  }
  return null;
}
