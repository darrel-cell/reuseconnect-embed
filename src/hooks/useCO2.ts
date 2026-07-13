// Custom hook for CO2 calculations
import { useQuery } from '@tanstack/react-query';
import { co2Service, type CO2CalculationRequest, type CO2CalculationResponse } from '@/services/co2.service';

export function useCO2Calculation(request: CO2CalculationRequest | null) {
  return useQuery<CO2CalculationResponse>({
    queryKey: ['co2Calculation', request],
    queryFn: () => co2Service.calculateCO2e(request!),
    enabled: !!request && request.assets.length > 0,
    staleTime: 30000,
    placeholderData: (previousData) => previousData, // Keep previous data while fetching
    retry: 1, // Retry once on failure
  });
}

export function useJobCO2e(jobId: string | undefined) {
  return useQuery({
    queryKey: ['jobCO2e', jobId],
    queryFn: () => jobId ? co2Service.getJobCO2e(jobId) : null,
    enabled: !!jobId,
    staleTime: 60000,
  });
}

