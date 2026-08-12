/**
 * AuthContext and its hook.
 *
 * Separate from the provider component so the provider file exports nothing but
 * a component. React Fast Refresh can only preserve state across an edit when a
 * module's exports are all components, so mixing the hook in here used to break
 * hot reload for every consumer.
 */

import { createContext, useContext } from 'react';
import type { AuthState, User, Tenant, LoginCredentials, SignupData, InviteData } from '@/types/auth';
import type { EmbedPartnerInfo } from '@/lib/embed-session';

export interface AuthContextType extends AuthState {
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

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
