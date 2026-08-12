// Custom hooks for booking history
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingService, type BookingListFilter } from '@/services/booking.service';
import { jmlBookingService } from '@/services/jml-booking.service';
import { useAuth } from '@/contexts/auth-context';
import type { Booking } from '@/mocks/mock-entities';

export function useBookings(filter?: BookingListFilter) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['bookings', user?.id, filter],
    queryFn: () => bookingService.getBookings(user, filter),
  });
}

/**
 * Paginated bookings, exposing the total so a list can say "showing 20 of 340"
 * and offer a next page.
 *
 * `useBookings` above returns rows only and is kept for the callers that
 * genuinely want a single page (dashboards, pickers). Anything user-facing that
 * lists bookings should use this instead — otherwise records past the first page
 * are unreachable.
 */
export function useBookingsPage(filter?: BookingListFilter) {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['bookings', 'page', user?.id, filter],
    queryFn: () => bookingService.getBookingsPage(filter),
    // Keep the previous page visible while the next one loads, so the table does
    // not collapse to a spinner on every page change.
    placeholderData: (prev) => prev,
  });

  return {
    ...query,
    bookings: query.data?.data ?? [],
    pagination: query.data?.pagination,
  };
}

export function useBooking(id: string | null) {
  return useQuery({
    queryKey: ['bookings', id],
    queryFn: () => id ? bookingService.getBookingById(id) : null,
    enabled: !!id,
  });
}

export function useAssignDriver() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: ({ bookingId, driverId, vehicleId }: { bookingId: string; driverId: string; vehicleId?: string }) =>
      bookingService.assignDriver(bookingId, driverId, user?.id || '', vehicleId),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
      await queryClient.refetchQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useBookCourier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ bookingId, trackingNumber, courierService }: { bookingId: string; trackingNumber: string; courierService: string }) =>
      jmlBookingService.updateCourierTracking(bookingId, trackingNumber, courierService),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
}

export function useCompleteBooking() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (bookingId: string) =>
      bookingService.completeBooking(bookingId, user?.id || ''),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
      await queryClient.refetchQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useApproveBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      bookingId,
      erpJobNumber,
      notes,
      collectionCost,
      scheduledDate,
    }: {
      bookingId: string;
      erpJobNumber: string;
      notes?: string;
      collectionCost?: number;
      scheduledDate?: string;
    }) =>
      bookingService.approveBooking(bookingId, erpJobNumber, notes, collectionCost, scheduledDate),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
      await queryClient.refetchQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useUpdateBookingStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ bookingId, status, notes }: { bookingId: string; status: Booking['status']; notes?: string }) =>
      bookingService.updateBookingStatus(bookingId, status, notes),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
      // Refetch job list so status label updates immediately (backend syncs job when booking status changes)
      await queryClient.refetchQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useUpdateScheduledDate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ bookingId, scheduledDate }: { bookingId: string; scheduledDate: string }) =>
      bookingService.updateScheduledDate(bookingId, scheduledDate),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
      await queryClient.refetchQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useCheckJobIdUnique() {
  return useMutation({
    mutationFn: ({ bookingId, erpJobNumber }: { bookingId: string; erpJobNumber: string }) =>
      bookingService.checkJobIdUnique(bookingId, erpJobNumber),
  });
}

export function useDeleteBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ bookingId, reason }: { bookingId: string; reason: string }) =>
      bookingService.deleteBooking(bookingId, reason),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
      await queryClient.refetchQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useUpdateBookingAssets() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      bookingId,
      assets,
      reason,
    }: {
      bookingId: string;
      assets: Array<
        | { assetId: string; quantity: number }
        | { categoryId: string; quantity: number }
      >;
      reason?: string;
    }) => bookingService.updateBookingAssets(bookingId, assets, reason),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      await queryClient.refetchQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useUpdateErpJobNumber() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      bookingId,
      erpJobNumber,
      reason,
    }: {
      bookingId: string;
      erpJobNumber: string;
      reason?: string;
    }) => bookingService.updateErpJobNumber(bookingId, erpJobNumber, reason),
    onSuccess: async (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['bookings', variables.bookingId] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      await queryClient.refetchQueries({ queryKey: ['jobs'] });
    },
  });
}

