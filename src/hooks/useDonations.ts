// Hook for donations to social projects (the dashboard's social section).
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { donationsService } from '@/services/donations.service';

export function useDonationSummary(clientId: string | null, months: number) {
  return useQuery({
    queryKey: ['donations', 'summary', clientId, months],
    queryFn: () => donationsService.getSummary(clientId, months),
    placeholderData: keepPreviousData,
    retry: false,
    refetchOnWindowFocus: false,
  });
}
