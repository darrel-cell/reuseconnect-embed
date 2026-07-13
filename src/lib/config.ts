// Application configuration and environment flags

/**
 * Base URL for the backend API
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * Free ngrok intercepts browser requests with an HTML interstitial (200, no CORS).
 * Send this header on all API calls when the base URL points at ngrok.
 */
export function apiTunnelHeaders(): Record<string, string> {
  if (/ngrok/i.test(API_BASE_URL)) {
    return { 'ngrok-skip-browser-warning': 'true' };
  }
  return {};
}

