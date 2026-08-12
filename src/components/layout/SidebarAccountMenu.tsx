import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, ChevronUp, LogOut, Settings, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type SidebarAccountMenuProps = {
  isCollapsed: boolean;
  userName: string;
  userRole: string;
  orgLabel: string;
  onNavClick?: () => void;
  showSettingsLinks?: boolean;
};

const sidebarMenuItemClass =
  "cursor-pointer text-sidebar-foreground/80 focus:bg-sidebar-accent focus:text-sidebar-accent-foreground";

function SidebarAccountMenu({
  isCollapsed,
  userName,
  userRole,
  orgLabel,
  onNavClick,
  showSettingsLinks = true,
}: SidebarAccountMenuProps) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  const handleNavigate = (path: string) => {
    navigate(path);
    onNavClick?.();
    setMenuOpen(false);
  };

  const handleLogoutClick = () => {
    setMenuOpen(false);
    setLogoutOpen(true);
  };

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex w-full items-center rounded-lg border border-sidebar-border/70 bg-sidebar-accent/40 text-sidebar-foreground transition-colors hover:bg-sidebar-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
              isCollapsed
                ? "h-10 w-10 justify-center p-0"
                : "gap-3 p-2.5"
            )}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary/20 text-sidebar-primary">
              <Building2 className="h-4 w-4" />
            </div>
            {!isCollapsed && (
              <>
                <div className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-medium">{userName}</p>
                  <p className="truncate text-xs capitalize text-sidebar-foreground/60">
                    {userRole} · {orgLabel}
                  </p>
                </div>
                <ChevronUp
                  className={cn(
                    "h-4 w-4 shrink-0 text-sidebar-foreground/50 transition-transform duration-200",
                    !menuOpen && "rotate-180"
                  )}
                />
              </>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side={isCollapsed ? "right" : "top"}
          align={isCollapsed ? "end" : "start"}
          className="w-56 border-sidebar-border bg-sidebar text-sidebar-foreground"
        >
          <DropdownMenuLabel className="font-normal text-sidebar-foreground">
            <div className="flex flex-col gap-0.5">
              <span className="truncate font-medium">{userName}</span>
              <span className="truncate text-xs capitalize text-sidebar-foreground/60">
                {userRole} · {orgLabel}
              </span>
            </div>
          </DropdownMenuLabel>
          {showSettingsLinks && (
            <>
              <DropdownMenuSeparator className="bg-sidebar-border" />
              <DropdownMenuItem className={sidebarMenuItemClass} onClick={() => handleNavigate("/profile")}>
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem className={sidebarMenuItemClass} onClick={() => handleNavigate("/settings")}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator className="bg-sidebar-border" />
          <DropdownMenuItem
            onClick={handleLogoutClick}
            className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Logout</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to logout? You&apos;ll need to sign in again to access your account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => logout()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Logout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export { SidebarAccountMenu };
