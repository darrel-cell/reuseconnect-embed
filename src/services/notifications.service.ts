// Notifications Service
import type { Notification } from '@/contexts/NotificationContext';
import { apiClient } from './api-client';

export interface NotificationResponse {
  notifications: Notification[];
  total: number;
}

export interface UnreadCountResponse {
  count: number;
}

class NotificationsService {
  /**
   * Get notifications
   */
  async getNotifications(options?: {
    read?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<NotificationResponse> {
    const params = new URLSearchParams();
    if (options?.read !== undefined) {
      params.append('read', options.read.toString());
    }
    if (options?.limit) {
      params.append('limit', options.limit.toString());
    }
    if (options?.offset) {
      params.append('offset', options.offset.toString());
    }

    const queryString = params.toString();
    const endpoint = `/notifications${queryString ? `?${queryString}` : ''}`;

    const response = await apiClient.get<{ notifications: Notification[]; total: number }>(endpoint);

    return {
      notifications: response.notifications || [],
      total: response.total || 0,
    };
  }

  /**
   * Get unread count
   */
  async getUnreadCount(): Promise<number> {
    const response = await apiClient.get<{ count: number }>('/notifications/unread-count');
    return response.count;
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    await apiClient.patch(`/notifications/${notificationId}/read`);
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<void> {
    await apiClient.patch('/notifications/read-all');
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: string): Promise<void> {
    await apiClient.delete(`/notifications/${notificationId}`);
  }

  /**
   * Delete all read notifications
   */
  async deleteAllRead(): Promise<void> {
    await apiClient.delete('/notifications/read');
  }
}

export const notificationsService = new NotificationsService();
