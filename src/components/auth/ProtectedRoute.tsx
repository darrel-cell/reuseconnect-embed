// Protected Route Component
import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useDriver } from '@/hooks/useDrivers';
import { useClientProfile } from '@/hooks/useClients';
import { useOrganisationProfileComplete } from '@/hooks/useOrganisationProfile';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: string[];
  requireSuperAdmin?: boolean;
}


export function ProtectedRoute({ children, allowedRoles, requireSuperAdmin }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user, hasRole } = useAuth();
  const location = useLocation();
  const isHeadOfOperation = user?.role === 'head_of_operation';
  const isDriver = user?.role === 'driver';
  const isDriverLike = isDriver || isHeadOfOperation;
  const isClient = user?.role === 'client';
  const isReseller = user?.role === 'partner';
  const isSettingsPage = location.pathname === '/settings';
  const isLoginPage = location.pathname === '/login';
  const isSignupPage = location.pathname === '/signup';
  const isAcceptInvitePage = location.pathname.startsWith('/accept-invite');

  // Check driver profile completeness (only for drivers)
  const { data: driverProfile, isLoading: isLoadingDriverProfile } = useDriver(
    isDriverLike ? user?.id || null : null
  );
  // For non-driver-like roles, isLoadingDriverProfile will be false (query is disabled)

  // Check client profile completeness (only for clients)
  const { data: clientProfile, isLoading: isLoadingClientProfile } = useClientProfile();
  // For non-clients, isLoadingClientProfile will be false (query is disabled)
  
  // Check organisation profile completeness for partner and head_of_operation roles
  const { data: isOrganisationProfileComplete, isLoading: isLoadingOrganisationProfile } =
    useOrganisationProfileComplete(isReseller || isHeadOfOperation);
  // For other roles, isLoadingOrganisationProfile will be false (query is disabled)
  const hasIncompleteResellerProfile = isReseller && !isOrganisationProfileComplete;
  const hasIncompleteHeadOfOperationProfile =
    isHeadOfOperation && (!driverProfile?.hasProfile || !isOrganisationProfileComplete);

  // Only show loading spinner if:
  // 1. Auth is loading
  // 2. Driver profile is loading (and user is driver/head_of_operation, not on settings page)
  // 3. Client profile is loading (and user is client, not on settings page)
  // 4. Organisation profile is loading (and user is partner/head_of_operation, not on settings page)
  const isProfileLoading = 
    (isDriverLike && isLoadingDriverProfile && !isSettingsPage) || 
    (isClient && isLoadingClientProfile && !isSettingsPage) ||
    ((isReseller || isHeadOfOperation) && isLoadingOrganisationProfile && !isSettingsPage);

  if (isLoading || isProfileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-2 px-6 text-center bg-slate-50">
        <p className="text-sm font-medium text-slate-900">Session required</p>
        <p className="text-sm text-slate-600 max-w-sm">
          Open this portal from your partner website so we can sign you in automatically.
        </p>
        <p className="text-xs text-slate-400 mt-2">Powered by ReuseConnect</p>
      </div>
    );
  }

  // Check if driver has complete profile (exclude settings page from this check)
  if (isDriver && !isSettingsPage && (!driverProfile || !driverProfile.hasProfile)) {
    return <Navigate to="/settings" replace />;
  }

  // Check if client has complete profile (exclude settings page from this check)
  if (isClient && !isSettingsPage && (!clientProfile || !clientProfile.hasProfile)) {
    return <Navigate to="/settings" replace />;
  }

  // Check if reseller has complete organisation profile (exclude settings page from this check)
  if (isReseller && !isSettingsPage && hasIncompleteResellerProfile) {
    return <Navigate to="/settings" replace />;
  }

  // Head of Operation must complete both driver profile and organisation profile
  // before accessing operational pages (exclude settings page from this check).
  if (isHeadOfOperation && !isSettingsPage && hasIncompleteHeadOfOperationProfile) {
    return <Navigate to="/settings" replace />;
  }

  // Allow pending users to VIEW pages but show banner and disable controls
  const isPending = user && user.status === 'pending' && user.role !== 'admin';
  // Don't disable sidebar and settings page
  const shouldDisableContent = isPending && !isSettingsPage;

  if (allowedRoles && user && !hasRole(allowedRoles)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requireSuperAdmin && user && !user.isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className={shouldDisableContent ? '[&_aside]:pointer-events-auto [&_aside]:opacity-100 [&_[data-sidebar]]:pointer-events-auto [&_[data-sidebar]]:opacity-100 [&_[data-main-content]]:pointer-events-none [&_[data-main-content]]:opacity-60' : ''}>
      {children}
    </div>
  );
}

