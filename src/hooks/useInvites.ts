import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authService } from '@/services/auth.service';
import type { Invite } from '@/types/auth';
import { toast } from 'sonner';

export function useInvites(
  status?: 'pending' | 'accepted' | 'expired',
  role?: 'client' | 'partner' | 'driver' | 'warehouse_technician' | 'head_of_operation'
) {
  return useQuery({
    queryKey: ['invites', status, role],
    queryFn: () => authService.listInvites(status, role),
  });
}

export function useCancelInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (inviteId: string) => authService.cancelInvite(inviteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invites'] });
      toast.success('Invitation cancelled successfully');
    },
    onError: (error) => {
      toast.error('Failed to cancel invitation', {
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    },
  });
}

