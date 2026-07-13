// Custom hooks for user management
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersService } from '@/services/users.service';
import type { ExtendedUser } from '@/mocks/mock-entities';

export function useUsers(filter?: { role?: string; tenantId?: string; isActive?: boolean; status?: string }) {
  return useQuery({
    queryKey: ['users', filter],
    queryFn: () => usersService.getUsers(filter),
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: ['users', id],
    queryFn: () => usersService.getUser(id),
    enabled: !!id,
  });
}

export function useUpdateUserStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => {
      // Convert boolean to status: true -> 'active', false -> 'inactive'
      const status = isActive ? 'active' : 'inactive';
      return usersService.updateUserStatus(id, status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
  });
}

export function useApproveUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => usersService.approveUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
  });
}

export function useDeclineUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => usersService.declineUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      email?: string;
      phone?: string | null;
      role?: 'admin' | 'head_of_operation' | 'client' | 'partner' | 'driver' | 'warehouse_technician';
    }) => usersService.updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      role: 'admin' | 'head_of_operation' | 'client' | 'partner' | 'driver' | 'warehouse_technician';
      name: string;
      email: string;
      password: string;
      phone?: string;
      organisationName: string;
      registrationNumber?: string;
      address?: string;
    }) => usersService.createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
  });
}

export function useResetUserPassword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, password }: { id: string; password?: string }) =>
      usersService.resetUserPassword(id, password),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      usersService.deleteUser(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
  });
}
