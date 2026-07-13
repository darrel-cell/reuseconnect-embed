// Sanitisation Service (for admin sanitisation management)
import type { SanitisationRecord } from '@/mocks/mock-entities';
import { ApiError, ApiErrorType } from './api-error';
import { apiClient } from './api-client';

class SanitisationService {
  async getSanitisationRecords(bookingId?: string): Promise<SanitisationRecord[]> {
    try {
      const params = bookingId ? `?bookingId=${bookingId}` : '';
      const records = await apiClient.get<SanitisationRecord[]>(`/sanitisation${params}`);
      return records;
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 404) {
        return [];
      }
      throw error;
    }
  }

  async createSanitisationRecord(
    bookingId: string,
    assetId: string,
    method: SanitisationRecord['method'],
    performedBy: string,
    methodDetails?: string,
    notes?: string
  ): Promise<SanitisationRecord> {
    const record = await apiClient.post<SanitisationRecord>('/sanitisation', {
      bookingId,
      assetId,
      method,
      methodDetails,
      notes,
    });
    return record;
  }

  async verifySanitisation(recordId: string): Promise<SanitisationRecord> {
    const record = await apiClient.post<SanitisationRecord>(`/sanitisation/${recordId}/verify`, {});
    return record;
  }
}

export const sanitisationService = new SanitisationService();
