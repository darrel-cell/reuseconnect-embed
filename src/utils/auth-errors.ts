import { ApiError, ApiErrorType } from '@/services/api-error';

export function getAuthErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.message && !Object.values(ApiErrorType).includes(error.message as ApiErrorType)) {
      return error.message;
    }

    switch (error.type) {
      case ApiErrorType.NETWORK_ERROR:
        return 'Network error. Please check your connection and try again.';
      case ApiErrorType.RATE_LIMIT:
        return 'Too many requests. Please try again later.';
      case ApiErrorType.VALIDATION_ERROR:
        return error.message || 'Please check your input and try again.';
      default:
        return fallback;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
