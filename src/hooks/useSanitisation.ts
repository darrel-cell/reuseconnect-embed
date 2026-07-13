// Custom hooks for sanitisation
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sanitisationService } from '@/services/sanitisation.service';
import type { SanitisationRecord } from '@/mocks/mock-entities';

export function useSanitisationRecords(bookingId?: string) {
  return useQuery({
    queryKey: ['sanitisation', bookingId],
    queryFn: () => sanitisationService.getSanitisationRecords(bookingId),
  });
}

export function useCreateSanitisationRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      bookingId: string;
      assetId: string;
      method: SanitisationRecord['method'];
      performedBy: string;
      methodDetails?: string;
      notes?: string;
    }) => sanitisationService.createSanitisationRecord(
      data.bookingId,
      data.assetId,
      data.method,
      data.performedBy,
      data.methodDetails,
      data.notes
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sanitisation'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
}

export function useVerifySanitisation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (recordId: string) => sanitisationService.verifySanitisation(recordId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sanitisation'] });
    },
  });
}

