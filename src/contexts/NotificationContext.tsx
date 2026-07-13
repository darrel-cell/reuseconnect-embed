// Notification Context for shared state
import { createContext, useContext, ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext';
import { notificationsService } from '@/services/notifications.service';

// Notification type definition
export interface Notification {
  id: string;
  type: 'success' | 'warning' | 'info' | 'error';
  title: string;
  message: string;
  time: string;
  read: boolean;
  url?: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  deleteNotification: (id: string) => void;
  refreshNotifications: () => void;
  isMarkingAllAsRead: boolean;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Fallback notifications for mock mode
const getNotificationsByRole = (role: string): Notification[] => {
  const baseNotifications: Notification[] = [
    {
      id: '1',
      type: 'success',
      title: 'Job completed',
      message: 'Job ERP-2024-00142 has been completed successfully',
      time: '2 hours ago',
      read: false,
      url: role === 'driver' ? '/driver/jobs/job-001' : '/jobs/job-001'
    },
    {
      id: '2',
      type: 'warning',
      title: 'Collection reminder',
      message: role === 'driver' 
        ? 'You have a collection scheduled for tomorrow' 
        : 'Booking booking-002 is scheduled for tomorrow',
      time: '5 hours ago',
      read: false,
      url: role === 'driver' ? '/driver/schedule' : '/bookings/booking-002'
    },
    {
      id: '3',
      type: 'info',
      title: 'Certificate ready',
      message: 'Data wipe certificate is now available for download',
      time: '1 day ago',
      read: false,
      url: '/documents'
    },
    {
      id: '5',
      type: 'success',
      title: 'Booking updated',
      message: 'Your booking status has been updated',
      time: '2 days ago',
      read: true,
      url: '/bookings'
    },
    {
      id: '6',
      type: 'info',
      title: 'New document available',
      message: 'ESG report for Q4 2024 is now available',
      time: '3 days ago',
      read: true,
      url: '/documents'
    }
  ];

  // Add role-specific notifications
  if (role === 'driver') {
    baseNotifications.unshift({
      id: '4',
      type: 'info',
      title: 'New job assigned',
      message: 'A new collection job has been assigned to you',
      time: '3 hours ago',
      read: false,
      url: '/driver/jobs/job-002'
    });
  } else if (role === 'admin') {
    baseNotifications.unshift({
      id: '4',
      type: 'warning',
      title: 'Pending approval',
      message: 'Booking booking-003 requires your approval',
      time: '1 hour ago',
      read: false,
      url: '/admin/approval/booking-003'
    });
  } else if (role === 'client' || role === 'partner') {
    baseNotifications.unshift({
      id: '4',
      type: 'info',
      title: 'Booking confirmed',
      message: 'Your booking has been confirmed and scheduled',
      time: '4 hours ago',
      read: false,
      url: '/bookings/booking-001'
    });
  }

  return baseNotifications;
};

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch notifications from API - only when explicitly requested (e.g., when bell icon is clicked)
  // No automatic polling - fetched on-demand only
  const { data: notificationsData, isLoading, refetch: refetchNotifications } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) {
        return { notifications: [], total: 0 };
      }
      try {
        const result = await notificationsService.getNotifications();
        return result;
      } catch (error) {
        console.error('[NotificationContext] Failed to fetch notifications:', error);
        // Return empty notifications on error
        return { notifications: [], total: 0 };
      }
    },
    enabled: !!user?.id, // Enabled when user is logged in, but no automatic polling
    refetchInterval: false, // No automatic polling - only fetch on-demand
    staleTime: Infinity, // Consider data fresh until manually refetched
  });

  // Fetch unread count
  const { data: unreadCountData, refetch: refetchUnreadCount } = useQuery({
    queryKey: ['notifications', 'unread-count', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      try {
        return await notificationsService.getUnreadCount();
      } catch (error) {
        console.error('Failed to fetch unread count:', error);
        return 0;
      }
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Keep polling every 30 seconds
  });

  const notifications = notificationsData?.notifications || [];
  const unreadCount = unreadCountData ?? notifications.filter(n => !n.read).length;

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => notificationsService.markAsRead(id),
    onSuccess: async () => {
      // Invalidate and refetch notifications list to show updated read status
      await queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
      await refetchNotifications();
      // Immediately refetch unread count to update the badge
      await refetchUnreadCount();
    },
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: () => notificationsService.markAllAsRead(),
    onSuccess: async () => {
      // Invalidate and refetch notifications list to show updated read status
      await queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
      await refetchNotifications();
      // Immediately refetch unread count to update the badge
      await refetchUnreadCount();
    },
  });

  // Delete notification mutation
  const deleteNotificationMutation = useMutation({
    mutationFn: (id: string) => notificationsService.deleteNotification(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count', user?.id] });
    },
  });

  const markAsRead = (id: string) => {
    markAsReadMutation.mutate(id);
  };

  const markAllAsRead = () => {
    markAllAsReadMutation.mutate();
  };

  const deleteNotification = (id: string) => {
    deleteNotificationMutation.mutate(id);
  };

  const refreshNotifications = () => {
    // Fetch notifications list when explicitly called (e.g., when bell icon is clicked)
    refetchNotifications();
    // Also immediately refetch unread count to update the badge without waiting for polling
    refetchUnreadCount();
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        refreshNotifications,
        isMarkingAllAsRead: markAllAsReadMutation.isPending,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

