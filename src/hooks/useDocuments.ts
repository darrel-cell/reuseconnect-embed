// Custom hooks for documents
import { useQuery } from '@tanstack/react-query';
import { documentsService } from '@/services/documents.service';
import { useAuth } from '@/contexts/AuthContext';

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

