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
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { steeringWheel } from "@lucide/lab";
import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { useTenantTheme } from "@/contexts/tenant-theme-context";
import { useReferralLogoSrc } from "@/hooks/useReferralLogoSrc";
import { useClientProfile } from "@/hooks/useClients";
import { SidebarAccountMenu } from "@/components/layout/SidebarAccountMenu";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const SIDEBAR_CATEGORY_STATE_KEY = "sidebar-category-state";

type NavCategoryId =
  | "operations"
  | "organization"
  | "fleet"
  | "warehouse"
  | "documents"
  | "co2";

const SteeringWheelIcon = ({ className }: { className?: string }) => {
  return <Icon iconNode={steeringWheel} className={className} />;
};

type NavIcon = LucideIcon | typeof SteeringWheelIcon;

type NavItem = {
  title: string;
  url: string;
  icon: NavIcon;
  roles: string[];
  category?: NavCategoryId;
};

type NavSection =
  | { type: "item"; item: NavItem }
  | { type: "category"; id: NavCategoryId; label: string; icon: LucideIcon; items: NavItem[] };

const NAV_CATEGORIES: { id: NavCategoryId; label: string; icon: LucideIcon }[] = [
  { id: "operations", label: "Operations", icon: Briefcase },
  { id: "organization", label: "Organization", icon: Building2 },
  { id: "fleet", label: "Fleet", icon: Truck },
  { id: "warehouse", label: "Warehouse", icon: Package },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "co2", label: "CO2 Dashboard", icon: Leaf },
];

const readCategoryState = (): Record<string, boolean> => {
  try {
    const stored = localStorage.getItem(SIDEBAR_CATEGORY_STATE_KEY);
    if (stored) return JSON.parse(stored) as Record<string, boolean>;
  } catch {
    // ignore invalid persisted state
  }
  return {};
};

const persistCategoryState = (state: Record<string, boolean>) => {
  localStorage.setItem(SIDEBAR_CATEGORY_STATE_KEY, JSON.stringify(state));
};

const getMainNavItems = (role: string): NavItem[] => {
  const baseItems: NavItem[] = [
    { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, roles: ['admin', 'head_of_operation', 'client', 'partner', 'driver', 'warehouse_technician'] },
    { title: "New Booking", url: "/booking", icon: Plus, roles: ['admin', 'head_of_operation', 'client'], category: "operations" },
    { title: "Jobs", url: "/jobs", icon: Briefcase, roles: ['admin', 'head_of_operation', 'client', 'partner', 'driver'], category: "operations" },
    { title: "Warehouse Process", url: "/jobs", icon: Briefcase, roles: ['warehouse_technician'], category: "warehouse" },
    { title: "Route & Schedule", url: "/driver/schedule", icon: RouteIcon, roles: ['driver', 'head_of_operation'], category: "operations" },
    { title: "Job History", url: "/jobs/history", icon: Clock, roles: ['driver', 'head_of_operation', 'warehouse_technician'], category: "operations" },
    { title: "Bookings", url: "/bookings", icon: FileText, roles: ['admin', 'head_of_operation', 'client', 'partner'], category: "operations" },
    { title: "Booking Queue", url: "/admin/bookings", icon: ClipboardList, roles: ['admin', 'head_of_operation'], category: "operations" },
    { title: "Clients", url: "/clients", icon: Building2, roles: ['admin', 'head_of_operation', 'partner'], category: "organization" },
    { title: "Sites", url: "/sites", icon: MapPin, roles: ['admin', 'head_of_operation', 'client'], category: "organization" },
    { title: "Inventory", url: "/inventory", icon: Package, roles: ['admin', 'head_of_operation', 'client'], category: "warehouse" },
    { title: "Drivers", url: "/admin/drivers", icon: SteeringWheelIcon, roles: ['admin', 'head_of_operation'], category: "fleet" },
    { title: "Vehicles", url: "/admin/vehicles", icon: Truck, roles: ['admin', 'head_of_operation'], category: "fleet" },
    { title: "Documents", url: "/documents", icon: FileText, roles: ['admin', 'head_of_operation', 'client', 'partner'], category: "documents" },
    { title: "CO₂e Overview", url: "/co2e", icon: Leaf, roles: ['admin', 'head_of_operation', 'client', 'partner'], category: "co2" },
    { title: "Organisation", url: "/co2e?view=organisation", icon: Building2, roles: ['admin', 'head_of_operation', 'client', 'partner'], category: "co2" },
    { title: "User", url: "/co2e?view=user", icon: Users, roles: ['admin', 'head_of_operation', 'client', 'partner'], category: "co2" },
    { title: "Serial Number", url: "/co2e?view=serial", icon: Package, roles: ['admin', 'head_of_operation', 'client', 'partner'], category: "co2" },
  ];

  return baseItems.filter(item => item.roles.includes(role));
};

const buildNavSections = (items: NavItem[]): NavSection[] => {
  const dashboard = items.find((item) => item.url === "/dashboard");
  const categorizedItems = items.filter((item) => item.url !== "/dashboard");

  const itemsByCategory = new Map<NavCategoryId, NavItem[]>();
  for (const category of NAV_CATEGORIES) {
    itemsByCategory.set(category.id, []);
  }
  for (const item of categorizedItems) {
    if (item.category) {
      itemsByCategory.get(item.category)?.push(item);
    }
  }

  const sections: NavSection[] = [];
  if (dashboard) {
    sections.push({ type: "item", item: dashboard });
  }

  for (const category of NAV_CATEGORIES) {
    const categoryItems = itemsByCategory.get(category.id) ?? [];
    if (categoryItems.length === 0) continue;
    if (categoryItems.length === 1) {
      sections.push({ type: "item", item: categoryItems[0] });
    } else {
      sections.push({
        type: "category",
        id: category.id,
        label: category.label,
        icon: category.icon,
        items: categoryItems,
      });
    }
  }

  return sections;
};

const formatRoleLabel = (role: string) => {
  const labels: Record<string, string> = {
    admin: "Admin",
    client: "Client",
    partner: "Partner",
    driver: "Driver",
    head_of_operation: "Head of Operation",
    warehouse_technician: "Warehouse Technician",
  };
  return labels[role] || role.replace(/_/g, " ");
};

function AppSidebar() {
  const location = useLocation();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const isCollapsed = state === "collapsed";
  const { user, partner } = useAuth();
  const { logo } = useTenantTheme();
  const { data: clientProfile } = useClientProfile();
  const contentRef = useRef<HTMLDivElement>(null);
  const [hasOverflowAbove, setHasOverflowAbove] = useState(false);
  const [hasOverflowBelow, setHasOverflowBelow] = useState(false);
  const resolvedPartnerLogo = useReferralLogoSrc(partner?.logoUrl);
  const partnerLogoSrc = resolvedPartnerLogo || logo || '/logo.avif';
  const brandTitle = partner?.displayName || 'Partner portal';
  const orgLabel = clientProfile?.organisationName || brandTitle;

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
  const navSections = useMemo(() => buildNavSections(mainNavItems), [mainNavItems]);
  const [categoryState, setCategoryState] = useState<Record<string, boolean>>(readCategoryState);
  const allNavUrls = useMemo(
    () => mainNavItems.map((item) => item.url),
    [mainNavItems]
  );
  const bestMatchScore = useMemo(
    () =>
      allNavUrls.reduce((best, path) => {
        const score = getPathMatchScore(path);
        return score > best ? score : best;
      }, -1),
    // getPathMatchScore is redefined each render but reads only location, which is
    // already a dependency — including it would recompute on every render for no
    // change in result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allNavUrls, location.pathname, location.search]
  );
  const isActive = (path: string) => getPathMatchScore(path) === bestMatchScore && bestMatchScore >= 0;

  const isCategoryOpen = (categoryId: NavCategoryId) => categoryState[categoryId] !== false;

  const setCategoryOpen = (categoryId: NavCategoryId, open: boolean) => {
    setCategoryState((prev) => {
      const next = { ...prev, [categoryId]: open };
      persistCategoryState(next);
      return next;
    });
  };

  const mainNavButtonClass = (active: boolean, nested = false) =>
    cn(
      "rounded-lg transition-all duration-200",
      isCollapsed
        ? "!h-10 !min-h-10 !w-10 !min-w-10 justify-center p-0 [&_svg]:!size-5"
        : nested
          ? "h-9"
          : "h-11",
      active
        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md font-semibold"
        : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent hover:shadow-sm"
    );

  const mainNavLinkClass = cn(
    "flex items-center min-w-0 transition-all duration-200",
    isCollapsed ? "w-10 justify-center" : "w-full gap-3"
  );

  const renderNavItem = (item: NavItem, nested = false) => (
    <SidebarMenuItem key={item.title}>
      <SidebarMenuButton
        asChild
        isActive={isActive(item.url)}
        tooltip={item.title}
        className={mainNavButtonClass(isActive(item.url), nested)}
      >
        <NavLink
          to={item.url}
          className={mainNavLinkClass}
          onClick={handleNavClick}
        >
          <item.icon className={cn("shrink-0 transition-all duration-200", isCollapsed ? "size-5" : "h-4 w-4")} />
          {!isCollapsed && <span className={cn(nested ? "font-normal" : "font-medium")}>{item.title}</span>}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
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
  }, [isCollapsed, mainNavItems.length, navSections.length]);

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
        {!isCollapsed && (
          <p className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
            Menu
          </p>
        )}
        <SidebarGroup className="p-0">
          {isCollapsed ? (
            <SidebarGroupContent>
              <SidebarMenu className="items-center">
                {mainNavItems.map((item) => renderNavItem(item))}
              </SidebarMenu>
            </SidebarGroupContent>
          ) : (
            <div className="flex flex-col gap-1">
              {navSections.map((section) =>
                section.type === "item" ? (
                  <SidebarMenu key={`item-${section.item.title}`}>
                    {renderNavItem(section.item)}
                  </SidebarMenu>
                ) : (
                  <Collapsible
                    key={section.id}
                    open={isCategoryOpen(section.id)}
                    onOpenChange={(open) => setCategoryOpen(section.id, open)}
                    className="rounded-lg bg-sidebar-accent/25"
                  >
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-sidebar-foreground/45 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground/75"
                      >
                        <section.icon className="h-3.5 w-3.5 shrink-0" />
                        <span className="flex-1 text-left text-[11px] font-semibold uppercase tracking-wider">
                          {section.label}
                        </span>
                        <ChevronDown
                          className={cn(
                            "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                            !isCategoryOpen(section.id) && "-rotate-90"
                          )}
                        />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-3 border-l border-sidebar-border/80 pb-1.5 pl-2 pr-1">
                        <SidebarMenu>
                          {section.items.map((item) => renderNavItem(item, true))}
                        </SidebarMenu>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )
              )}
            </div>
          )}
        </SidebarGroup>
        {isCollapsed && hasOverflowBelow && (
          <div className="pointer-events-none absolute bottom-1 left-1/2 z-20 -translate-x-1/2 rounded-full bg-sidebar/55 p-0.5 text-sidebar-foreground/45 backdrop-blur-[1px]">
            <ChevronDown className="h-3.5 w-3.5" />
          </div>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border bg-black/15 p-2">
        {user && (
          <SidebarAccountMenu
            isCollapsed={isCollapsed}
            userName={user.name}
            userRole={formatRoleLabel(user.role)}
            orgLabel={orgLabel}
            onNavClick={handleNavClick}
          />
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

export { AppSidebar };
