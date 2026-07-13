import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { organisationProfileService, OrganisationProfile, OrganisationProfileData } from '@/services/organisation-profile.service';

export function useOrganisationProfile() {
  return useQuery({
    queryKey: ['organisation-profile'],
    queryFn: () => organisationProfileService.getProfile(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useUpdateOrganisationProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: OrganisationProfileData) => organisationProfileService.upsertProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organisation-profile'] });
      queryClient.invalidateQueries({ queryKey: ['organisation-profile', 'complete'] });
    },
  });
}

export function useOrganisationProfileComplete(enabled: boolean = true) {
  return useQuery({
    queryKey: ['organisation-profile', 'complete'],
    queryFn: () => organisationProfileService.checkProfileComplete(),
    enabled, // Only run when enabled (for resellers)
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false, // Don't retry on error to avoid blocking
    refetchOnWindowFocus: false, // Don't refetch on window focus
  });
}

