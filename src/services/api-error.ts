export enum ApiErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  RATE_LIMIT = 'RATE_LIMIT',
  SERVER_ERROR = 'SERVER_ERROR',
  TIMEOUT = 'TIMEOUT',
  BAD_REQUEST = 'BAD_REQUEST',
}

export class ApiError extends Error {
  constructor(
    public type: ApiErrorType,
    message: string,
    public statusCode?: number,
    public details?: Record<string, unknown>,
    public fields?: Record<string, string> // Field-specific validation errors
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ErrorSimulationConfig {
  enabled: boolean;
  errorRate: number;
  errorType?: ApiErrorType;
  delay?: number;
}

export function getErrorSimulationConfig(serviceName: string): ErrorSimulationConfig {
  if (process.env.NODE_ENV !== 'development') {
    return {
      enabled: false,
      errorRate: 0,
    };
  }
  
  const stored = localStorage.getItem(`error_sim_${serviceName}`);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // Invalid JSON
    }
  }
  return {
    enabled: false,
    errorRate: 0,
  };
}

export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function shouldSimulateError(serviceName: string): boolean {
  if (process.env.NODE_ENV !== 'development') {
    return false;
  }
  
  const config = getErrorSimulationConfig(serviceName);
  if (!config.enabled) return false;
  return Math.random() <= config.errorRate;
}
