// Buyback Calculation Service
import { apiClient } from './api-client';

export interface BuybackCalculationRequest {
  assets: Array<{
    categoryId: string;
    quantity: number;
    // Used to enforce accessory rules even if category mapping/name in DB differs.
    isAccessory?: boolean;
  }>;
}

export interface BuybackCalculationResponse {
  estimatedBuyback: number; // £
}

class BuybackService {
  async calculateBuyback(request: BuybackCalculationRequest): Promise<BuybackCalculationResponse> {
    const response = await apiClient.post<BuybackCalculationResponse>('/buyback/calculate', {
      assets: request.assets,
    });
    return response;
  }
}

export const buybackService = new BuybackService();
