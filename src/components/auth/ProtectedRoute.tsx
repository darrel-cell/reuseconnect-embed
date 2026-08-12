// Protected Route Component
import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/auth-context';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: string[];
  requireSuperAdmin?: boolean;
}

export function ProtectedRoute({ children, allowedRoles, requireSuperAdmin }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user, hasRole } = useAuth();

  if (isLoading) {
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

  const isPending = user && user.status === 'pending' && user.role !== 'admin';
  const shouldDisableContent = isPending;

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
