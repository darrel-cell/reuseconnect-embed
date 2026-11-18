// Hook for the dashboard's environmental figures (RTG's method, from graded stock).
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { environmentalService } from '@/services/environmental.service';

const KEY = ['environmental'] as const;

export function useEnvironmentalOverview(clientId: string | null, months: number) {
  return useQuery({
    queryKey: [...KEY, 'overview', clientId, months],
    queryFn: () => environmentalService.getOverview(clientId, months),
    placeholderData: keepPreviousData,
    retry: false,
    refetchOnWindowFocus: false,
  });
}
