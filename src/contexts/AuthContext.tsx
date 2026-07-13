import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
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

interface AuthContextType extends AuthState {
  partner: EmbedPartnerInfo | null;
  isLoading: boolean;
  hasRole: (roles: string[]) => boolean;
  establishEmbedSession: (token: string) => Promise<AuthState>;
  setPartner: (partner: EmbedPartnerInfo | null) => void;
  login: (credentials: LoginCredentials) => Promise<AuthState | { requiresTwoFactor: true; userId: string; email: string; message: string }>;
  verifyTwoFactor: (userId: string, code: string) => Promise<AuthState>;
  resendTwoFactorCode: (userId: string) => Promise<{ message: string }>;
  signup: (data: SignupData) => Promise<void>;
  signupClient: (data: Omit<SignupData, 'role'>) => Promise<void>;
  signupPartner: (data: Omit<SignupData, 'role'>) => Promise<void>;
  acceptInvite: (data: InviteData) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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

  useEffect(() => {
    const token = getStoredAuthToken();
    if (token) {
      apiClient.setAuthToken(token);
    }

    authService.getCurrentAuth().then((auth) => {
      if (auth && auth.user?.role === 'client') {
        setAuthState({
          ...auth,
          token: token,
        });
      } else if (auth && auth.user?.role !== 'client') {
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
    apiClient.setAuthToken(null);
    apiClient.setCsrfToken(null);
    setPartnerState(null);
    setAuthState({
      user: null,
      tenant: null,
      token: null,
      isAuthenticated: false,
    });
  };

  const hasRole = (roles: string[]): boolean => {
    if (!authState.user) return false;
    return roles.includes(authState.user.role);
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

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
