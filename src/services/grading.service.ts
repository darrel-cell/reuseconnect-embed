// Grading Service (for admin grading management)
import type { GradingRecord } from '@/mocks/mock-entities';
import { ApiError, ApiErrorType } from './api-error';
import { apiClient } from './api-client';

class GradingService {
  async getGradingRecords(bookingId?: string): Promise<GradingRecord[]> {
    try {
      const params = bookingId ? `?bookingId=${bookingId}` : '';
      const records = await apiClient.get<GradingRecord[]>(`/grading${params}`);
      return records;
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 404) {
        return [];
      }
      throw error;
    }
  }

  async createGradingRecord(
    bookingId: string,
    assetId: string,
    assetCategory: string,
    grade: GradingRecord['grade'],
    gradedBy: string,
    condition?: string,
    notes?: string,
    quantity?: number,
    serialNumbers?: string[],
    imeiNumbers?: string[]
  ): Promise<GradingRecord> {
    const record = await apiClient.post<GradingRecord>('/grading', {
      bookingId,
      assetId,
      assetCategory,
      grade,
      condition,
      notes,
      quantity,
      serialNumbers,
      imeiNumbers,
    });
    return record;
  }

  async calculateResaleValue(category: string, grade: GradingRecord['grade'], quantity: number): Promise<number> {
    try {
      const response = await apiClient.get<number>(`/grading/calculate-resale-value?category=${encodeURIComponent(category)}&grade=${encodeURIComponent(grade)}&quantity=${quantity}`);
      return response || 0;
    } catch (error) {
      console.error('Failed to calculate resale value:', error);
      // Return 0 if API fails
      return 0;
    }
  }
}

export const gradingService = new GradingService();
