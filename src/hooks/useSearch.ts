// Search Hook
import { useQuery } from '@tanstack/react-query';
import { searchService } from '@/services/search.service';
import { useAuth } from '@/contexts/AuthContext';

export function useSearch(query: string) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['search', query],
    queryFn: () => searchService.search(query, user),
    enabled: query.length >= 2,
    staleTime: 30000,
  });
}

