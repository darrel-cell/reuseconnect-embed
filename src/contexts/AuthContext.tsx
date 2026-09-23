import { useCallback, useEffect, useState, ReactNode } from 'react';
import type { AuthState, User, Tenant, LoginCredentials, SignupData, InviteData } from '@/types/auth';
import { authService } from '@/services/auth.service';
import { apiClient } from '@/services/api-client';
import { embedService } from '@/services/embed.service';
import {
  clearEmbedSession,
  getParentOrigin,
  getStoredAuthToken,
  getStoredPartner,
  setStoredAuthToken,
  setStoredPartner,
  type EmbedPartnerInfo,
} from '@/lib/embed-session';
import { AuthContext, type AuthContextType } from './auth-context';



function unsupportedEmbedAuth(): never {
  throw new Error('Password login is not available in the embed portal. Open this app from your partner website.');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    tenant: null,
    token: null,
    isAuthenticated: false,
  });
  const [partner, setPartnerState] = useState<EmbedPartnerInfo | null>(getStoredPartner());
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Drop the session locally.
   *
   * Deliberately keeps the stored partner so the "Session required" screen can
   * still show whose portal this is; only the credential goes.
   */
  const endSession = useCallback(() => {
    setStoredAuthToken(null);
    apiClient.setAuthToken(null);
    apiClient.setCsrfToken(null);
    setAuthState({ user: null, tenant: null, token: null, isAuthenticated: false });
  }, []);

  /**
   * Act on an expired or revoked session instead of letting the iframe sit on
   * stale data. `ProtectedRoute` renders "Open this portal from your partner
   * website" as soon as `isAuthenticated` goes false, which is the only remedy
   * available here — the embed has no sign-in form of its own.
   */
  useEffect(() => {
    apiClient.setSessionExpiredHandler(endSession);
    return () => apiClient.setSessionExpiredHandler(null);
  }, [endSession]);

  useEffect(() => {
    const token = getStoredAuthToken();
    if (token) {
      apiClient.setAuthToken(token);
    }

    authService.getCurrentAuth().then((auth) => {
      const role = auth?.user?.role;
      if (auth && (role === 'client' || role === 'partner')) {
        setAuthState({
          ...auth,
          token: token,
        });
      } else if (auth && role) {
        clearEmbedSession();
        apiClient.setAuthToken(null);
        setAuthState({
          user: null,
          tenant: null,
          token: null,
          isAuthenticated: false,
        });
      }
      setIsLoading(false);
    });
  }, []);

  const setPartner = (next: EmbedPartnerInfo | null) => {
    setPartnerState(next);
    setStoredPartner(next);
  };

  const establishEmbedSession = async (token: string) => {
    const result = await embedService.exchangeToken(token, getParentOrigin());
    setStoredAuthToken(result.token);
    apiClient.setAuthToken(result.token);
    // Re-arm, so an expiry later in this session is acted on rather than
    // suppressed by the once-only notice from a previous one.
    apiClient.resetSessionExpiredNotice();
    if (result.csrfToken) {
      apiClient.setCsrfToken(result.csrfToken);
    }

    const user = result.user as User;
    const tenant: Tenant = {
      id: user.tenantId,
      name: (user as User & { tenantName?: string }).tenantName || result.partner.displayName || 'Organisation',
      slug: user.tenantId,
      createdAt: user.createdAt || new Date().toISOString(),
    };

    const auth: AuthState = {
      user: {
        ...user,
        tenantName: (user as User & { tenantName?: string }).tenantName || result.partner.displayName,
        createdAt: user.createdAt || new Date().toISOString(),
      },
      tenant,
      token: result.token,
      isAuthenticated: true,
    };

    setPartner(result.partner);
    setAuthState(auth);
    return auth;
  };

  const logout = async () => {
    clearEmbedSession();
    setPartnerState(null);
    endSession();
  };

  const hasRole = (roles: string[]): boolean => {
    if (!authState.user) return false;
    const userRole = authState.user.role;
    const isHeadOfOperation = userRole === 'head_of_operation';
    const adminEquivalent = isHeadOfOperation && roles.includes('admin');
    const driverEquivalent = isHeadOfOperation && roles.includes('driver');
    return (
      roles.includes(userRole) ||
      adminEquivalent ||
      driverEquivalent ||
      (!!authState.user.isSuperAdmin && roles.includes('admin'))
    );
  };

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        partner,
        isLoading,
        hasRole,
        establishEmbedSession,
        setPartner,
        login: unsupportedEmbedAuth,
        verifyTwoFactor: unsupportedEmbedAuth,
        resendTwoFactorCode: unsupportedEmbedAuth,
        signup: unsupportedEmbedAuth,
        signupClient: unsupportedEmbedAuth,
        signupPartner: unsupportedEmbedAuth,
        acceptInvite: unsupportedEmbedAuth,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

