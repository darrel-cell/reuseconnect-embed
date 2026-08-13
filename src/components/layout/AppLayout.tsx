import { useState, useRef, useEffect } from "react";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Bell, Search, Loader2, FileText, Building2, Truck, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSearch } from "@/hooks/useSearch";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useNotifications } from "@/contexts/notification-context";
import { useAuth } from "@/contexts/auth-context";
import { chromeTitleForPath } from "@/lib/page-titles";


export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const pageTitle = chromeTitleForPath(location.pathname, location.search);
  const { data: searchResults, isLoading: isSearching } = useSearch(searchQuery);
  
  // Notification state from context
  const { notifications, unreadCount, markAsRead, markAllAsRead, refreshNotifications, isMarkingAllAsRead } = useNotifications();
  const [isNotificationPopoverOpen, setIsNotificationPopoverOpen] = useState(false);
  
  // Check if user is pending approval
  const { user } = useAuth();
  const isPending = user && user.status === 'pending' && user.role !== 'admin';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (searchInputRef.current && 
          !searchInputRef.current.contains(target) &&
          !(target instanceof Element && target.closest('[data-search-dropdown]'))) {
        setIsSearchOpen(false);
      }
    };

    if (isSearchOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isSearchOpen]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setIsSearchOpen(value.length >= 2);
  };

  const handleResultClick = (url: string) => {
    navigate(url);
    setSearchQuery("");
    setIsSearchOpen(false);
    searchInputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsSearchOpen(false);
      searchInputRef.current?.blur();
    } else if (e.key === 'Enter' && searchResults?.results && searchResults.results.length > 0) {
      handleResultClick(searchResults.results[0].url);
    }
  };

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'job':
        return <Truck className="h-4 w-4" />;
      case 'client':
        return <Building2 className="h-4 w-4" />;
      case 'booking':
        return <FileText className="h-4 w-4" />;
      default:
        return <Search className="h-4 w-4" />;
    }
  };

  const getNotificationIcon = (type: 'success' | 'warning' | 'info' | 'error') => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-warning" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 'info':
      default:
        return <Info className="h-4 w-4 text-info" />;
    }
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead();
  };

  const handleNotificationClick = (notification: typeof notifications[0]) => {
    // Mark as read
    if (!notification.read) {
      markAsRead(notification.id);
    }
    
    // Close the notification popover
    setIsNotificationPopoverOpen(false);
    
    // Navigate if URL exists
    if (notification.url) {
      navigate(notification.url);
    }
  };

  const handleViewAllNotifications = () => {
    setIsNotificationPopoverOpen(false); // Close the popover
    navigate("/notifications");
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar data-sidebar />
        <SidebarInset className="flex flex-col flex-1" data-main-content>
          {/* Pending Approval Banner - Only show once at layout level */}
          {isPending && (
            <div className="bg-warning/10 border-b border-warning/20 px-4 py-3">
              <div className="max-w-7xl mx-auto flex items-center gap-2">
                <div className="text-2xl">⏳</div>
                <div>
                  <p className="font-medium text-warning-foreground">
                    Account Pending Approval
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Your account is pending admin approval. You can view features but cannot interact with them until approved.
                  </p>
                </div>
              </div>
            </div>
          )}
          {/* Top Header */}
          <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6">
            <SidebarTrigger className="-ml-2" />
            
            <div className="flex-1">
              <h1 className="text-xl font-semibold text-foreground">{pageTitle}</h1>
            </div>

            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative hidden md:block" ref={searchInputRef}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  ref={searchInputRef}
                  placeholder="Search jobs, clients..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={() => {
                    if (searchQuery.length >= 2) {
                      setIsSearchOpen(true);
                    }
                  }}
                  className="w-64 pl-9 bg-secondary/50 border-0 focus-visible:ring-1"
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}

                {/* Search Results Dropdown */}
                {isSearchOpen && searchQuery.length >= 2 && (
                  <div data-search-dropdown className="absolute top-full right-0 mt-2 w-[400px] rounded-lg border bg-popover shadow-lg z-50">
                    <div className="max-h-[400px] overflow-y-auto">
                      {isSearching ? (
                        <div className="p-8 text-center">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
                        </div>
                      ) : searchResults?.results && searchResults.results.length > 0 ? (
                        <>
                          <div className="p-2 text-xs font-semibold text-muted-foreground uppercase border-b">
                            {searchResults.total} result{searchResults.total !== 1 ? 's' : ''}
                          </div>
                          {searchResults.results.map((result) => (
                            <button
                              key={`${result.type}-${result.id}`}
                              onClick={() => handleResultClick(result.url)}
                              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary transition-colors border-b last:border-b-0"
                            >
                              <div className={cn(
                                "flex items-center justify-center w-8 h-8 rounded-lg",
                                result.type === 'job' && "bg-primary/10 text-primary",
                                result.type === 'client' && "bg-accent/10 text-accent",
                                result.type === 'booking' && "bg-info/10 text-info"
                              )}>
                                {getResultIcon(result.type)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm text-foreground truncate">
                                  {result.title}
                                </div>
                                <div className="text-xs text-muted-foreground truncate">
                                  {result.subtitle}
                                </div>
                              </div>
                            </button>
                          ))}
                        </>
                      ) : (
                        <div className="p-8 text-center text-sm text-muted-foreground">
                          No results found for "{searchQuery}"
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Notifications */}
              <Popover open={isNotificationPopoverOpen} onOpenChange={(open) => {
                setIsNotificationPopoverOpen(open);
                // Fetch notifications when popover opens
                if (open) {
                  refreshNotifications();
                }
              }}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="end">
                  <div className="flex items-center justify-between p-4 border-b">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4" />
                      <h3 className="font-semibold text-sm">Notifications</h3>
                      {unreadCount > 0 && (
                        <span className="text-xs text-muted-foreground">({unreadCount} unread)</span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 px-2 text-xs"
                        onClick={handleMarkAllAsRead}
                        disabled={isMarkingAllAsRead}
                      >
                        {isMarkingAllAsRead ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            Marking...
                          </>
                        ) : (
                          'Mark all as read'
                        )}
                      </Button>
                    )}
                  </div>
                  <div className="max-h-[400px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-sm text-muted-foreground">
                        No notifications
                      </div>
                    ) : (
                      <div className="p-2 space-y-1">
                        {notifications.slice(0, 5).map((notification) => (
                          <div
                            key={notification.id}
                            onClick={() => handleNotificationClick(notification)}
                            className={cn(
                              "flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors",
                              !notification.read && "bg-muted/30"
                            )}
                          >
                            <div className="mt-0.5 flex-shrink-0">
                              {getNotificationIcon(notification.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{notification.title}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {notification.message}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">{notification.time}</p>
                            </div>
                            {!notification.read && (
                              <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-2" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="border-t p-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full text-xs" 
                      onClick={handleViewAllNotifications}
                    >
                      View all notifications
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 p-6 overflow-auto" data-main-content>
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
