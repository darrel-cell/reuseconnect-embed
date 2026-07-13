// Custom hooks for site management
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { siteService, type Site, type CreateSiteRequest, type UpdateSiteRequest } from '@/services/site.service';

export function useSites(clientId?: string) {
  return useQuery({
    queryKey: ['sites', clientId],
    queryFn: () => siteService.getSites(clientId),
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useSite(id: string) {
  return useQuery({
    queryKey: ['sites', id],
    queryFn: () => siteService.getSite(id),
    enabled: !!id,
    retry: false,
  });
}

export function useCreateSite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateSiteRequest) => siteService.createSite(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] });
    },
  });
}

export function useUpdateSite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSiteRequest }) =>
      siteService.updateSite(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] });
    },
  });
}

export function useDeleteSite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => siteService.deleteSite(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] });
    },
  });
}
