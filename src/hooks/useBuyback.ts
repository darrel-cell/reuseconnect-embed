// Custom hook for buyback calculations
import { useQuery } from '@tanstack/react-query';
import { buybackService, type BuybackCalculationRequest, type BuybackCalculationResponse } from '@/services/buyback.service';

export function useBuybackCalculation(request: BuybackCalculationRequest | null) {
  return useQuery<BuybackCalculationResponse>({
    queryKey: ['buybackCalculation', request],
    queryFn: () => buybackService.calculateBuyback(request!),
    enabled: !!request && request.assets.length > 0,
    staleTime: 30000,
    placeholderData: (previousData) => previousData, // Keep previous data while fetching
    retry: 1, // Retry once on failure
  });
}
