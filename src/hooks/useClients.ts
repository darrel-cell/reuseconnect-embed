// Custom hooks for client management
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clientsService } from '@/services/clients.service';
import { useAuth } from '@/contexts/AuthContext';

export function useClients(filter?: { status?: string; resellerId?: string }) {
  const { user } = useAuth();
  
  // Only enable query for admin and reseller roles
  const enabled = !!user && (user.role === 'admin' || user.role === 'partner');
  
  return useQuery({
    queryKey: ['clients', user?.id, filter],
    queryFn: () => clientsService.getClients(user, filter),
    enabled,
    retry: false, // Don't retry on error to avoid blocking
    refetchOnWindowFocus: false, // Don't refetch on window focus
  });
}

export function useClient(id: string) {
  return useQuery({
    queryKey: ['clients', id],
    queryFn: () => clientsService.getClient(id),
    enabled: !!id,
  });
}

export function useOrganisations(search?: string) {
  const { user } = useAuth();
  const enabled = !!user && (user.role === 'admin' || user.role === 'partner');

  return useQuery({
    queryKey: ['organisations', user?.id, search],
    queryFn: () => clientsService.getOrganisations(search),
    enabled,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useClientProfile() {
  const { user } = useAuth();
  const isClient = user?.role === 'client';
  
  return useQuery({
    queryKey: ['clientProfile', user?.id],
    queryFn: () => clientsService.getClientProfile(),
    enabled: isClient,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useUpdateClientProfile() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (data: { name: string; email: string; phone: string; organisationName: string; registrationNumber: string; address: string }) => clientsService.updateClientProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientProfile', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      // Invalidate user query to refresh name in auth context
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}

export function useUpdateClientStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ clientId, status }: { clientId: string; status: 'active' | 'inactive' | 'pending' }) =>
      clientsService.updateClientStatus(clientId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}

