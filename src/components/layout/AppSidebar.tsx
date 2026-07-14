import { 
  LayoutDashboard, 
  Plus, 
  Truck, 
  Leaf, 
  FileText, 
  Building2,
  Users,
  ClipboardList,
  Clock,
  Route as RouteIcon,
  MapPin,
  Icon,
  Briefcase,
  Package,
  ChevronUp,
  ChevronDown
} from "lucide-react";
import { steeringWheel } from "@lucide/lab";
import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useTenantTheme } from "@/contexts/TenantThemeContext";
import { useReferralLogoSrc } from "@/hooks/useReferralLogoSrc";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";

// Steering Wheel Icon Component (from @lucide/lab)
const SteeringWheelIcon = ({ className }: { className?: string }) => {
  return <Icon iconNode={steeringWheel} className={className} />;
};

// Role-based navigation items
const getMainNavItems = (role: string) => {
  const baseItems = [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, roles: ['admin', 'head_of_operation', 'client', 'partner', 'driver', 'warehouse_technician'] },
    { title: "New Booking", url: "/booking", icon: Plus, roles: ['admin', 'head_of_operation', 'client'] },
    { title: "Jobs", url: "/jobs", icon: Briefcase, roles: ['admin', 'head_of_operation', 'client', 'partner', 'driver'] },
    { title: "Warehouse Process", url: "/jobs", icon: Briefcase, roles: ['warehouse_technician'] },
    { title: "Route & Schedule", url: "/driver/schedule", icon: RouteIcon, roles: ['driver', 'head_of_operation'] },
    { title: "Job History", url: "/jobs/history", icon: Clock, roles: ['driver', 'head_of_operation', 'warehouse_technician'] },
    { title: "Bookings", url: "/bookings", icon: FileText, roles: ['admin', 'head_of_operation', 'client', 'partner'] },
    { title: "Booking Queue", url: "/admin/bookings", icon: ClipboardList, roles: ['admin', 'head_of_operation'] },
    { title: "Users", url: "/users", icon: Users, roles: ['admin', 'head_of_operation'] },
    { title: "Clients", url: "/clients", icon: Building2, roles: ['admin', 'head_of_operation', 'partner'] },
    { title: "Sites", url: "/sites", icon: MapPin, roles: ['admin', 'head_of_operation', 'client'] },
    { title: "Inventory", url: "/inventory", icon: Package, roles: ['admin', 'head_of_operation', 'client'] },
    { title: "Drivers", url: "/admin/drivers", icon: SteeringWheelIcon, roles: ['admin', 'head_of_operation'] },
    { title: "Vehicles", url: "/admin/vehicles", icon: Truck, roles: ['admin', 'head_of_operation'] },
    { title: "CO₂e Overview", url: "/co2e", icon: Leaf, roles: ['admin', 'head_of_operation', 'client', 'partner'] },
    { title: "Organisation", url: "/co2e?view=organisation", icon: Building2, roles: ['admin', 'head_of_operation', 'client', 'partner'] },
    { title: "User", url: "/co2e?view=user", icon: Users, roles: ['admin', 'head_of_operation', 'client', 'partner'] },
    { title: "Serial Number", url: "/co2e?view=serial", icon: Package, roles: ['admin', 'head_of_operation', 'client', 'partner'] },
    { title: "Documents", url: "/documents", icon: FileText, roles: ['admin', 'head_of_operation', 'client', 'partner'] },
  ];
  
  return baseItems.filter(item => item.roles.includes(role));
};

function AppSidebar() {
  const location = useLocation();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const isCollapsed = state === "collapsed";
  const { user, partner } = useAuth();
  const { logo } = useTenantTheme();
  const contentRef = useRef<HTMLDivElement>(null);
  const [hasOverflowAbove, setHasOverflowAbove] = useState(false);
  const [hasOverflowBelow, setHasOverflowBelow] = useState(false);
  const resolvedPartnerLogo = useReferralLogoSrc(partner?.logoUrl);
  const partnerLogoSrc = resolvedPartnerLogo || logo || '/logo.avif';
  const brandTitle = partner?.displayName || 'Partner portal';

  const getPathMatchScore = (path: string) => {
    const [targetPath, targetQuery] = path.split('?');
    if (targetPath === "/dashboard") return location.pathname === "/dashboard" ? targetPath.length : -1;
    if (!location.pathname.startsWith(targetPath)) return -1;
    if (!targetQuery) return targetPath.length;
    const [key, value] = targetQuery.split('=');
    const current = new URLSearchParams(location.search).get(key);
    return current === value ? targetPath.length + 1000 : -1;
  };

  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const mainNavItems = user ? getMainNavItems(user.role) : [];
  const co2NavItems = mainNavItems.filter(item => item.url.startsWith('/co2e'));
  const primaryNavItems = mainNavItems.filter(item => !item.url.startsWith('/co2e'));
  const allNavUrls = useMemo(
    () => [...primaryNavItems, ...co2NavItems].map((item) => item.url),
    [primaryNavItems, co2NavItems]
  );
  const bestMatchScore = useMemo(
    () =>
      allNavUrls.reduce((best, path) => {
        const score = getPathMatchScore(path);
        return score > best ? score : best;
      }, -1),
    [allNavUrls, location.pathname, location.search]
  );
  const isActive = (path: string) => getPathMatchScore(path) === bestMatchScore && bestMatchScore >= 0;

  const mainNavButtonClass = (active: boolean) =>
    cn(
      "rounded-lg transition-all duration-200",
      isCollapsed
        ? "!h-10 !min-h-10 !w-10 !min-w-10 justify-center p-0 [&_svg]:!size-5"
        : "h-11",
      active
        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md font-semibold"
        : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent hover:shadow-sm"
    );

  const mainNavLinkClass = cn(
    "flex items-center min-w-0 transition-all duration-200",
    isCollapsed ? "w-10 justify-center" : "w-full gap-3"
  );

  useEffect(() => {
    const element = contentRef.current;
    if (!element) return;

    const updateScrollHints = () => {
      const maxScrollTop = element.scrollHeight - element.clientHeight;
      setHasOverflowAbove(element.scrollTop > 2);
      setHasOverflowBelow(maxScrollTop - element.scrollTop > 2);
    };

    updateScrollHints();
    element.addEventListener("scroll", updateScrollHints, { passive: true });
    window.addEventListener("resize", updateScrollHints);

    const resizeObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(updateScrollHints)
      : null;
    resizeObserver?.observe(element);

    return () => {
      element.removeEventListener("scroll", updateScrollHints);
      window.removeEventListener("resize", updateScrollHints);
      resizeObserver?.disconnect();
    };
  }, [isCollapsed, primaryNavItems.length, co2NavItems.length]);

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className={cn("p-4", isCollapsed && "px-2 pb-2 pt-3")}>
        <div className={cn("flex items-center", isCollapsed ? "justify-center w-full" : "gap-3")}>
          <img 
            src={partnerLogoSrc} 
            alt={brandTitle}
            className={cn(
              "object-contain transition-all duration-200",
              isCollapsed ? "h-8 w-8 max-w-[2rem] mx-auto" : "h-10 w-auto max-w-[140px]"
            )}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const placeholder = document.createElement('div');
              placeholder.className = `flex items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground font-bold ${isCollapsed ? 'h-8 w-8 text-base' : 'h-10 w-10 text-lg'}`;
              placeholder.textContent = (brandTitle || 'P').charAt(0).toUpperCase();
              e.currentTarget.parentNode?.insertBefore(placeholder, e.currentTarget);
            }}
          />
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-sidebar-foreground text-base truncate">
                {brandTitle}
              </span>
              <span className="text-xs text-sidebar-foreground/60">Powered by ReuseConnect</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent
        ref={contentRef}
        className={cn(
          "relative px-2",
          isCollapsed && "group-data-[collapsible=icon]:overflow-y-auto"
        )}
      >
        {isCollapsed && hasOverflowAbove && (
          <div className="pointer-events-none absolute left-1/2 top-1 z-20 -translate-x-1/2 rounded-full bg-sidebar/55 p-0.5 text-sidebar-foreground/45 backdrop-blur-[1px]">
            <ChevronUp className="h-3.5 w-3.5" />
          </div>
        )}
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs uppercase tracking-wider px-3">
            {!isCollapsed && "Main Menu"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className={cn(isCollapsed && "items-center")}>
              {primaryNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                    className={mainNavButtonClass(isActive(item.url))}
                  >
                    <NavLink 
                      to={item.url} 
                      className={mainNavLinkClass}
                      onClick={handleNavClick}
                    >
                      <item.icon className={cn("shrink-0 transition-all duration-200", isCollapsed ? "size-5" : "h-5 w-5")} />
                      {!isCollapsed && <span className="font-medium">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {co2NavItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs uppercase tracking-wider px-3">
              {!isCollapsed && "CO2 Dashboard"}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className={cn(isCollapsed && "items-center")}>
                {co2NavItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      tooltip={item.title}
                      className={mainNavButtonClass(isActive(item.url))}
                    >
                      <NavLink
                        to={item.url}
                        className={mainNavLinkClass}
                        onClick={handleNavClick}
                      >
                        <item.icon className={cn("shrink-0 transition-all duration-200", isCollapsed ? "size-5" : "h-5 w-5")} />
                        {!isCollapsed && <span className="font-medium">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        {isCollapsed && hasOverflowBelow && (
          <div className="pointer-events-none absolute bottom-1 left-1/2 z-20 -translate-x-1/2 rounded-full bg-sidebar/55 p-0.5 text-sidebar-foreground/45 backdrop-blur-[1px]">
            <ChevronDown className="h-3.5 w-3.5" />
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  );
}

export { AppSidebar };
