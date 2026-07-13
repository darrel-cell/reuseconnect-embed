// API Client for making HTTP requests to backend (embed: Bearer + CSRF)
import { API_BASE_URL, apiTunnelHeaders } from '@/lib/config';
import { ApiError, ApiErrorType } from './api-error';
import { getStoredAuthToken } from '@/lib/embed-session';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  fields?: Record<string, string>;
}

class ApiClient {
  private baseUrl: string;
  private csrfToken: string | null = null;
  private authToken: string | null = null;

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
            throw new ApiError(
              ApiErrorType.SERVER_ERROR,
              retryData.error || 'Request failed',
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
        throw new ApiError(
          errorType,
          data.error || data.message || 'Request failed',
          response.status,
          undefined,
          data.fields
        );
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

  async post<T>(endpoint: string, body?: any): Promise<T> {
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

  async put<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
