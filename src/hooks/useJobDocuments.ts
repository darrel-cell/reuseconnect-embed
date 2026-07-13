import { useQuery } from '@tanstack/react-query';
import { documentsService } from '@/services/documents.service';

export function useJobDocuments(jobId: string | null | undefined) {
  return useQuery({
    queryKey: ['documents', 'job', jobId],
    queryFn: () => documentsService.getJobDocuments(jobId!),
    enabled: !!jobId,
  });
}
