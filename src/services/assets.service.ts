// Assets Service
import type { AssetCategory } from '@/types/jobs';
import { ApiError, ApiErrorType } from './api-error';
import { apiClient } from './api-client';

class AssetsService {
  async getAssetCategories(): Promise<AssetCategory[]> {
    const categories = await apiClient.get<AssetCategory[]>('/asset-categories');
    return categories;
  }

  async getAssetCategory(id: string): Promise<AssetCategory | null> {
    try {
      const categories = await this.getAssetCategories();
      return categories.find(cat => cat.id === id) || null;
    } catch (error) {
      return null;
    }
  }
}

export const assetsService = new AssetsService();
