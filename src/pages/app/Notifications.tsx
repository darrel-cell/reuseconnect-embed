import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { 
  Bell, 
  CheckCircle2, 
  AlertCircle, 
  Info, 
  ArrowLeft,
  CheckCheck,
  Filter,
  Trash2,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNotifications, type Notification } from "@/contexts/notification-context";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const Notifications = () => {
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const readCount = notifications.filter(n => n.read).length;

  const getNotificationIcon = (type: 'success' | 'warning' | 'info' | 'error') => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-success" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-warning" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      case 'info':
      default:
        return <Info className="h-5 w-5 text-info" />;
    }
  };

  const getNotificationBadge = (type: 'success' | 'warning' | 'info' | 'error') => {
    switch (type) {
      case 'success':
        return <Badge variant="secondary" className="bg-success/10 text-success">Success</Badge>;
      case 'warning':
        return <Badge variant="secondary" className="bg-warning/10 text-warning">Warning</Badge>;
      case 'error':
        return <Badge variant="secondary" className="bg-destructive/10 text-destructive">Error</Badge>;
      case 'info':
      default:
        return <Badge variant="secondary" className="bg-info/10 text-info">Info</Badge>;
    }
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead();
    toast.success("All notifications marked as read");
  };

  const handleMarkAsRead = (id: string) => {
    markAsRead(id);
    toast.success("Notification marked as read");
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
    // Wait for animation before deleting
    setTimeout(() => {
      deleteNotification(id);
      setDeletingId(null);
      toast.success("Notification deleted");
    }, 300);
  };

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read when clicked
    if (!notification.read) {
      markAsRead(notification.id);
    }
    // Navigate to the URL
    if (notification.url) {
      navigate(notification.url);
    }
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.read;
    if (filter === 'read') return n.read;
    return true;
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Notifications</h2>
            <p className="text-muted-foreground">
              {unreadCount} unread • {readCount} read
            </p>
          </div>
        </div>
        {unreadCount > 0 && (
          <Button 
            variant="outline" 
            onClick={handleMarkAllAsRead}
            className="gap-1.5 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm h-8 sm:h-10"
          >
            <CheckCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Mark all as read</span>
            <span className="sm:hidden">Mark all</span>
          </Button>
        )}
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex items-center gap-4"
      >
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Filter:</span>
        </div>
        <Select value={filter} onValueChange={(value: 'all' | 'unread' | 'read') => setFilter(value)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All notifications</SelectItem>
            <SelectItem value="unread">Unread only</SelectItem>
            <SelectItem value="read">Read only</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      {/* Notifications List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-3"
      >
        {filteredNotifications.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Bell className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                {filter === 'unread' 
                  ? 'No unread notifications' 
                  : filter === 'read'
                  ? 'No read notifications'
                  : 'No notifications'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <AnimatePresence>
            {filteredNotifications.map((notification, index) => (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ 
                  opacity: deletingId === notification.id ? 0 : 1, 
                  y: deletingId === notification.id ? -20 : 0,
                  scale: deletingId === notification.id ? 0.95 : 1
                }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ 
                  delay: index * 0.05,
                  duration: deletingId === notification.id ? 0.3 : 0.2
                }}
              >
                <Card 
                  className={cn(
                    "hover:shadow-md transition-all cursor-pointer relative",
                    !notification.read && "border-l-4 border-l-primary bg-primary/10 shadow-sm",
                    deletingId === notification.id && "opacity-50"
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="mt-1 flex-shrink-0">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h3 className={cn(
                                "font-semibold text-sm",
                                !notification.read && "font-bold"
                              )}>
                                {notification.title}
                              </h3>
                              {getNotificationBadge(notification.type)}
                              {!notification.read && (
                                <Badge variant="default" className="h-2 w-2 p-0 rounded-full bg-primary" />
                              )}
                            </div>
                            <p className={cn(
                              "text-sm whitespace-pre-line",
                              !notification.read ? "text-foreground font-medium" : "text-muted-foreground"
                            )}>
                              {notification.message}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {!notification.read && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMarkAsRead(notification.id);
                                }}
                                title="Mark as read"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(notification.id);
                              }}
                              title="Delete notification"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-3">
                          <p className="text-xs text-muted-foreground">{notification.time}</p>
                          {notification.url && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-7 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleNotificationClick(notification);
                              }}
                            >
                              View details →
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </motion.div>
    </div>
  );
};

export default Notifications;

