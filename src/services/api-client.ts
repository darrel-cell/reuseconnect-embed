// API Client for making HTTP requests to backend (embed: Bearer + CSRF)
import { API_BASE_URL, apiTunnelHeaders } from '@/lib/config';
import { ApiError, ApiErrorType } from './api-error';
import { getStoredAuthToken } from '@/lib/embed-session';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  fields?: Record<string, string>;
  pagination?: PaginationMeta;
}

/** A list response with its pagination envelope preserved. */
export interface Paginated<T> {
  data: T[];
  pagination: PaginationMeta;
}

/** Endpoints where a 401/403 is an expected answer, not an expired session. */
const AUTH_PROBE_ENDPOINTS = ['/auth/me', '/auth/csrf-token', '/embed/'];

class ApiClient {
  private baseUrl: string;
  private csrfToken: string | null = null;
  private authToken: string | null = null;
  /** Invoked once when the server says the session is gone. */
  private onSessionExpired: (() => void) | null = null;
  private sessionExpiredNotified = false;

  constructor() {
    this.baseUrl = API_BASE_URL;
    this.authToken = getStoredAuthToken();
  }

  setCsrfToken(token: string | null) {
    this.csrfToken = token;
  }

  setAuthToken(token: string | null) {
    this.authToken = token;
  }

  getAuthToken(): string | null {
    return this.authToken || getStoredAuthToken();
  }

  /**
   * Register the app-wide handler for an expired or revoked session.
   *
   * The embed has no sign-in page to fall back to, so an expired session used to
   * leave the iframe showing stale data and an error toast on every action. The
   * only way back in is to reopen the portal from the partner's site, which is
   * what the handler needs to say.
   */
  setSessionExpiredHandler(handler: (() => void) | null) {
    this.onSessionExpired = handler;
  }

  /** Re-arm after a successful exchange so a later expiry is handled again. */
  resetSessionExpiredNotice() {
    this.sessionExpiredNotified = false;
  }

  private isAuthProbe(endpoint: string): boolean {
    return AUTH_PROBE_ENDPOINTS.some((p) => endpoint.startsWith(p));
  }

  /**
   * A 401 always means "no usable session". A 403 only means that when the
   * server explicitly says the account is not usable — an ordinary permission
   * denial must NOT end the session.
   */
  private handleAuthFailure(endpoint: string, status: number, message: string) {
    if (this.isAuthProbe(endpoint)) return;

    const accountUnusable =
      status === 403 &&
      /pending administrator approval|not active|was declined|Account has been removed/i.test(
        message
      );

    if (status !== 401 && !accountUnusable) return;

    this.csrfToken = null;
    if (this.sessionExpiredNotified) return;
    this.sessionExpiredNotified = true;
    this.onSessionExpired?.();
  }

  private async ensureCsrfToken(): Promise<string | null> {
    if (this.csrfToken) {
      return this.csrfToken;
    }

    try {
      const headers: HeadersInit = {
        ...apiTunnelHeaders(),
      };
      const authToken = this.getAuthToken();
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch(`${this.baseUrl}/auth/csrf-token`, {
        method: 'GET',
        credentials: 'include',
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.csrfToken) {
          this.csrfToken = data.data.csrfToken;
          return this.csrfToken;
        }
        return null;
      }
    } catch {
      // ignore
    }

    return null;
  }

  private buildHeaders(options: RequestInit, csrfToken: string | null, isStateChanging: boolean): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...apiTunnelHeaders(),
      ...(options.headers || {}),
    };

    if (isStateChanging && csrfToken) {
      (headers as Record<string, string>)['X-CSRF-Token'] = csrfToken;
    }

    const authToken = this.getAuthToken();
    if (authToken) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${authToken}`;
    }

    return headers;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method || 'GET');

    let csrfToken = this.csrfToken;
    if (isStateChanging && !csrfToken) {
      csrfToken = await this.ensureCsrfToken();
    }

    const headers = this.buildHeaders(options, csrfToken, isStateChanging);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include',
      });

      const data: ApiResponse<T> = await response.json();

      if (
        response.status === 403 &&
        isStateChanging &&
        data.error &&
        (data.error.includes('CSRF') || data.error.includes('csrf'))
      ) {
        this.csrfToken = null;
        const newToken = await this.ensureCsrfToken();
        if (newToken) {
          const retryHeaders = this.buildHeaders(options, newToken, true);
          const retryResponse = await fetch(url, {
            ...options,
            headers: retryHeaders,
            credentials: 'include',
          });
          const retryData: ApiResponse<T> = await retryResponse.json();
          if (!retryResponse.ok || !retryData.success) {
            const retryMessage = retryData.error || 'Request failed';
            this.handleAuthFailure(endpoint, retryResponse.status, retryMessage);
            throw new ApiError(
              ApiErrorType.SERVER_ERROR,
              retryMessage,
              retryResponse.status,
              undefined,
              retryData.fields
            );
          }
          return retryData.data as T;
        }
      }

      if (!response.ok) {
        let errorType = ApiErrorType.SERVER_ERROR;
        switch (response.status) {
          case 400:
            errorType = ApiErrorType.VALIDATION_ERROR;
            break;
          case 401:
            errorType = ApiErrorType.UNAUTHORIZED;
            break;
          case 403:
            errorType = ApiErrorType.FORBIDDEN;
            break;
          case 404:
            errorType = ApiErrorType.NOT_FOUND;
            break;
          case 429:
            errorType = ApiErrorType.RATE_LIMIT;
            break;
        }
        const message = data.error || data.message || 'Request failed';
        this.handleAuthFailure(endpoint, response.status, message);
        throw new ApiError(errorType, message, response.status, undefined, data.fields);
      }

      if (!data.success) {
        throw new ApiError(
          ApiErrorType.SERVER_ERROR,
          data.error || 'Request failed',
          response.status,
          undefined,
          data.fields
        );
      }

      if (data.data === undefined || data.data === null) {
        return null as T;
      }

      return data.data as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new ApiError(
          ApiErrorType.NETWORK_ERROR,
          'Network error. Please check your connection and try again.',
          0
        );
      }
      throw new ApiError(
        ApiErrorType.SERVER_ERROR,
        error instanceof Error ? error.message : 'An unexpected error occurred',
        500
      );
    }
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  /**
   * GET a list endpoint, keeping the pagination envelope.
   *
   * `get()` returns only `data.data`, which silently discarded the `pagination`
   * object the API has always sent. Combined with services that never passed
   * `page`/`limit`, every list in the portal showed the server default of 20 rows
   * with no next-page control and no indication that anything was hidden.
   */
  async getPaginated<T>(endpoint: string): Promise<Paginated<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: this.buildHeaders({}, null, false),
        credentials: 'include',
      });

      const body: ApiResponse<T[]> = await response.json();

      if (!response.ok || !body.success) {
        const errorMessage = body.error || body.message || 'Request failed';
        let errorType = ApiErrorType.SERVER_ERROR;
        switch (response.status) {
          case 400: errorType = ApiErrorType.VALIDATION_ERROR; break;
          case 401: errorType = ApiErrorType.UNAUTHORIZED; break;
          case 403: errorType = ApiErrorType.FORBIDDEN; break;
          case 404: errorType = ApiErrorType.NOT_FOUND; break;
          case 429: errorType = ApiErrorType.RATE_LIMIT; break;
        }
        this.handleAuthFailure(endpoint, response.status, errorMessage);
        throw new ApiError(errorType, errorMessage, response.status, undefined, body.fields);
      }

      const rows = body.data ?? [];
      return {
        data: rows,
        // Endpoints without server-side pagination return no envelope; describe
        // the full set as a single page so callers need no special case.
        pagination:
          body.pagination ??
          { page: 1, limit: rows.length, total: rows.length, totalPages: 1 },
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new ApiError(
          ApiErrorType.NETWORK_ERROR,
          'Network error. Please check your connection and try again.',
          0
        );
      }
      throw new ApiError(
        ApiErrorType.SERVER_ERROR,
        error instanceof Error ? error.message : 'An unexpected error occurred',
        500
      );
    }
  }

  async post<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async postFormData<T>(endpoint: string, formData: FormData): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    let csrfToken = this.csrfToken;
    if (!csrfToken) {
      csrfToken = await this.ensureCsrfToken();
    }

    const headers: HeadersInit = {
      ...apiTunnelHeaders(),
    };
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }
    const authToken = this.getAuthToken();
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      headers,
      credentials: 'include',
    });

    const data: ApiResponse<T> = await response.json();
    if (!response.ok || !data.success) {
      throw new ApiError(
        ApiErrorType.SERVER_ERROR,
        data.error || 'Request failed',
        response.status,
        undefined,
        data.fields
      );
    }
    return data.data as T;
  }

  async put<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  // Takes an optional body because deletions that need a reason (bookings,
  // users) send one. Matches the main portal's client so shared services can be
  // used unchanged.
  async delete<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
      body: body ? JSON.stringify(body) : undefined,
    });
  }
}

export const apiClient = new ApiClient();
