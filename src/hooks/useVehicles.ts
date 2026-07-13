// Custom hooks for vehicle management
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vehicleService, type Vehicle, type CreateVehicleData, type UpdateVehicleData } from '@/services/vehicle.service';

export function useVehicles() {
  return useQuery({
    queryKey: ['vehicles'],
    queryFn: () => vehicleService.getVehicles(),
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useVehicle(id: string | null) {
  return useQuery({
    queryKey: ['vehicles', id],
    queryFn: () => id ? vehicleService.getVehicleById(id) : null,
    enabled: !!id,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useVehicleByDriver(driverId: string | null) {
  return useQuery({
    queryKey: ['vehicles', 'driver', driverId],
    queryFn: () => driverId ? vehicleService.getVehicleByDriver(driverId) : [],
    enabled: !!driverId,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useCreateVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateVehicleData) => vehicleService.createVehicle(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
    },
  });
}

export function useUpdateVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateVehicleData }) =>
      vehicleService.updateVehicle(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
    },
  });
}

export function useAllocateVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ vehicleId, driverId }: { vehicleId: string; driverId: string | null }) =>
      vehicleService.allocateVehicle(vehicleId, driverId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles', 'driver'] });
    },
  });
}

export function useRemoveDriverFromVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ vehicleId, driverId }: { vehicleId: string; driverId: string }) =>
      vehicleService.removeDriverFromVehicle(vehicleId, driverId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles', 'driver'] });
    },
  });
}

export function useDeleteVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => vehicleService.deleteVehicle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
    },
  });
}
