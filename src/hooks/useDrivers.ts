// Custom hooks for driver management
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { driverService, type Driver, type DriverProfileRequest } from '@/services/driver.service';

export function useDrivers() {
  return useQuery({
    queryKey: ['drivers'],
    queryFn: () => driverService.getDrivers(),
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useDriver(id: string | null) {
  return useQuery({
    queryKey: ['drivers', id],
    queryFn: () => id ? driverService.getDriverById(id) : null,
    enabled: !!id,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useCreateDriverProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: DriverProfileRequest) => driverService.createOrUpdateProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
    },
  });
}

export function useUpdateDriverProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ driverId, data }: { driverId: string; data: Partial<DriverProfileRequest> }) =>
      driverService.updateProfile(driverId, data),
    onSuccess: (_, variables) => {
      // Invalidate all driver queries to ensure AppLayout and other components refetch
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      // Also invalidate the specific driver query
      queryClient.invalidateQueries({ queryKey: ['drivers', variables.driverId] });
    },
  });
}

export function useDeleteDriverProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (driverId: string) => driverService.deleteProfile(driverId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
    },
  });
}

