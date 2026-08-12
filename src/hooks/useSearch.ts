// Search Hook
import { useQuery } from '@tanstack/react-query';
import { searchService } from '@/services/search.service';
import { useAuth } from '@/contexts/auth-context';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

export function useSearch(query: string) {
  const { user } = useAuth();
  const debouncedQuery = useDebouncedValue(query.trim(), 300);
  
  return useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => searchService.search(debouncedQuery, user),
    enabled: debouncedQuery.length >= 2,
    staleTime: 30000,
    placeholderData: (previousData) => previousData,
  });
}
