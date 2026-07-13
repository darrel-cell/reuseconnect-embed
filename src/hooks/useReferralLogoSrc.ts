import { useEffect, useState } from 'react';
import { API_BASE_URL, apiTunnelHeaders } from '@/lib/config';
import { getReferralLogoUrl } from '@/utils/referral-logo-url';

/**
 * Resolves a partner logo for <img src>.
 * Free ngrok injects an HTML interstitial on bare browser image requests
 * (img tags cannot send ngrok-skip-browser-warning). Fetch with that header
 * and expose a blob URL instead.
 */
export function useReferralLogoSrc(logoUrl?: string | null): string | null {
  const [src, setSrc] = useState<string | null>(() => {
    const url = getReferralLogoUrl(logoUrl);
    if (!url) return null;
    if (/ngrok/i.test(API_BASE_URL) || /ngrok/i.test(url)) return null;
    return url;
  });

  useEffect(() => {
    const url = getReferralLogoUrl(logoUrl);
    if (!url) {
      setSrc(null);
      return;
    }

    const needsTunnelFetch = /ngrok/i.test(API_BASE_URL) || /ngrok/i.test(url);
    if (!needsTunnelFetch) {
      setSrc(url);
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(url, {
          headers: {
            ...apiTunnelHeaders(),
          },
        });
        if (!response.ok) {
          throw new Error('Failed to fetch logo');
        }
        const blob = await response.blob();
        if (blob.type.startsWith('text/html')) {
          throw new Error('Received HTML instead of image');
        }
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) {
          setSrc(objectUrl);
        }
      } catch {
        if (!cancelled) {
          setSrc(null);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [logoUrl]);

  return src;
}
