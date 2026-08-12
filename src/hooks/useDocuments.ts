// Custom hooks for documents
import { useQuery } from '@tanstack/react-query';
import { documentsService } from '@/services/documents.service';
import { useAuth } from '@/contexts/auth-context';

/** Paginated documents, exposing the total. Use this for the documents table. */
export function useDocumentsPage(filter?: { page?: number; limit?: number }) {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['documents', 'page', user?.id, filter?.page, filter?.limit],
    queryFn: () => documentsService.getDocumentsPage(filter),
    enabled: !!user,
    placeholderData: (prev) => prev,
  });

  return {
    ...query,
    documents: query.data?.data ?? [],
    pagination: query.data?.pagination,
  };
}

export function useDocuments() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['documents', user?.id],
    queryFn: async () => {
      const result = await documentsService.getDocuments();
      // Ensure we never return undefined
      return Array.isArray(result) ? result : [];
    },
    enabled: !!user,
    // Provide a default value to prevent undefined
    initialData: [],
  });
}

