// Custom hook for bookings
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingService, type BookingRequest } from '@/services/booking.service';

export function useCreateBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: BookingRequest) => bookingService.createBooking(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
    },
  });
}

