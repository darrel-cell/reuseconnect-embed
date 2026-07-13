import { useQuery } from '@tanstack/react-query';
import { documentsService } from '@/services/documents.service';

export function useBookingDocuments(bookingId: string | null | undefined) {
  return useQuery({
    queryKey: ['documents', 'booking', bookingId],
    queryFn: () => documentsService.getBookingDocuments(bookingId!),
    enabled: !!bookingId,
  });
}
