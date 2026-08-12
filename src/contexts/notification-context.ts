/**
 * NotificationContext and its hook.
 *
 * Separate from the provider component so the provider file exports nothing but
 * a component. React Fast Refresh can only preserve state across an edit when a
 * module's exports are all components, so mixing the hook in here used to break
 * hot reload for every consumer.
 */

import { createContext, useContext } from 'react';

/** An in-app notification, as the bell menu and the notifications page render it. */
export interface Notification {
  id: string;
  type: 'success' | 'warning' | 'info' | 'error';
  title: string;
  message: string;
  time: string;
  read: boolean;
  url?: string;
}

export interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  deleteNotification: (id: string) => void;
  refreshNotifications: () => void;
  isMarkingAllAsRead: boolean;
}

export const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
