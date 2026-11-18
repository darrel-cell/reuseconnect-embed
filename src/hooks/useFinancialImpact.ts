// Hook for the dashboard's financial section.
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { financialImpactService } from '@/services/financial-impact.service';

export function useFinancialOverview(clientId: string | null, months: number) {
  return useQuery({
    // Under 'jobs', so saving a job's buyback or cost refreshes these totals too.
    queryKey: ['jobs', 'financial-impact', clientId, months],
    queryFn: () => financialImpactService.getOverview(clientId, months),
    placeholderData: keepPreviousData,
    retry: false,
    refetchOnWindowFocus: false,
  });
}
