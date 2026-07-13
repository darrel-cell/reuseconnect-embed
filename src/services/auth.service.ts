// Authentication Service
import type { 
  User, 
  Tenant, 
  AuthState, 
  LoginCredentials, 
  SignupData, 
  InviteData,
  Invite 
} from '@/types/auth';
import { ApiError, ApiErrorType } from './api-error';
import { apiClient } from './api-client';

class AuthService {
  private currentUser: User | null = null;
  private currentTenant: Tenant | null = null;

  async login(credentials: LoginCredentials): Promise<AuthState | { requiresTwoFactor: true; userId: string; email: string; message: string }> {
    const response = await apiClient.post<{
      user?: User;
      tenant?: Tenant;
      csrfToken?: string;
      requiresTwoFactor?: boolean;
      userId?: string;
      email?: string;
      message?: string;
      // Token is now in httpOnly cookie, not in response
    }>('/auth/login', credentials);

    // Check if 2FA is required
    if (response.requiresTwoFactor && response.userId && response.email) {
      return {
        requiresTwoFactor: true,
        userId: response.userId,
        email: response.email,
        message: response.message || 'A verification code has been sent to your email address.',
      };
    }

    // No 2FA required - proceed with normal login
    if (!response.user || !response.tenant) {
      throw new Error('Invalid login response');
    }

    this.currentUser = response.user;
    this.currentTenant = response.tenant;

    // Store CSRF token for subsequent requests
    // The response structure is: { user, tenant, csrfToken }
    if (response.csrfToken) {
      apiClient.setCsrfToken(response.csrfToken);
    } else {
      // If CSRF token not in response, try to fetch it
      // Note: This should rarely happen as login response includes CSRF token
      try {
        const csrfResponse = await apiClient.get<{ csrfToken: string }>('/auth/csrf-token');
        if (csrfResponse.csrfToken) {
          apiClient.setCsrfToken(csrfResponse.csrfToken);
        }
      } catch (error) {
        // Silently handle - CSRF token will be fetched on next state-changing request
        // Only log in development for debugging
        if (process.env.NODE_ENV === 'development') {
          console.debug('CSRF token not available after login (will be fetched on next request)');
        }
      }
    }

    // Token is stored in httpOnly cookie automatically by backend
    // No need to store in localStorage (more secure)

    return {
      user: response.user,
      tenant: response.tenant,
      token: null, // Token is in httpOnly cookie, not accessible to JavaScript
      isAuthenticated: true,
    };
  }

  async verifyTwoFactor(userId: string, code: string): Promise<AuthState> {
    const response = await apiClient.post<{
      user: User;
      tenant: Tenant;
      csrfToken?: string;
      // Token is now in httpOnly cookie, not in response
    }>('/auth/verify-2fa', { userId, code });

    this.currentUser = response.user;
    this.currentTenant = response.tenant;

    // Store CSRF token for subsequent requests
    if (response.csrfToken) {
      apiClient.setCsrfToken(response.csrfToken);
    }

    // Token is stored in httpOnly cookie automatically by backend
    // No need to store in localStorage (more secure)

    return {
      user: response.user,
      tenant: response.tenant,
      token: null, // Token is in httpOnly cookie, not accessible to JavaScript
      isAuthenticated: true,
    };
  }

  async resendTwoFactorCode(userId: string): Promise<{ message: string }> {
    const response = await apiClient.post<{
      message: string;
    }>('/auth/resend-2fa', { userId });

    return response;
  }

  async signup(data: SignupData): Promise<AuthState> {
    const response = await apiClient.post<{
      user: User;
      tenant: Tenant;
      csrfToken?: string;
      // Token is now in httpOnly cookie, not in response
    }>('/auth/signup', data);

    this.currentUser = response.user;
    this.currentTenant = response.tenant;

    // Store CSRF token for subsequent requests
    if (response.csrfToken) {
      apiClient.setCsrfToken(response.csrfToken);
    }

    // Token is stored in httpOnly cookie automatically by backend
    // No need to store in localStorage (more secure)

    return {
      user: response.user,
      tenant: response.tenant,
      token: null, // Token is in httpOnly cookie, not accessible to JavaScript
      isAuthenticated: true,
    };
  }

  async signupClient(data: Omit<SignupData, 'role'>): Promise<AuthState> {
    const response = await apiClient.post<{
      user: User;
      tenant: Tenant;
      csrfToken?: string;
    }>('/auth/signup-client', data);

    this.currentUser = response.user;
    this.currentTenant = response.tenant;

    if (response.csrfToken) {
      apiClient.setCsrfToken(response.csrfToken);
    }

    return {
      user: response.user,
      tenant: response.tenant,
      token: null,
      isAuthenticated: true,
    };
  }

  async signupPartner(data: Omit<SignupData, 'role'>): Promise<AuthState> {
    const response = await apiClient.post<{
      user: User;
      tenant: Tenant;
      csrfToken?: string;
    }>('/auth/signup-partner', data);

    this.currentUser = response.user;
    this.currentTenant = response.tenant;

    if (response.csrfToken) {
      apiClient.setCsrfToken(response.csrfToken);
    }

    return {
      user: response.user,
      tenant: response.tenant,
      token: null,
      isAuthenticated: true,
    };
  }

  async acceptInvite(inviteData: InviteData): Promise<AuthState> {
    const result = await apiClient.post<{
      user: User;
      tenant: Tenant;
      csrfToken?: string;
      // Token is now in httpOnly cookie, not in response
    }>('/invites/accept', {
      inviteToken: inviteData.inviteToken,
      email: inviteData.email,
      name: inviteData.name,
      password: inviteData.password,
      organisationName: inviteData.organisationName,
    });

    this.currentUser = result.user;
    this.currentTenant = result.tenant;

    // Store CSRF token for subsequent requests
    if (result.csrfToken) {
      apiClient.setCsrfToken(result.csrfToken);
    }

    // Token is stored in httpOnly cookie automatically by backend
    // No need to store in localStorage (more secure)

    return {
      user: result.user,
      tenant: result.tenant,
      token: null, // Token is in httpOnly cookie, not accessible to JavaScript
      isAuthenticated: true,
    };
  }

  async getInvite(token: string): Promise<Invite | null> {
    try {
      const invite = await apiClient.get<Invite>(`/invites/token/${token}`);
      return invite;
    } catch (error) {
      if (error instanceof ApiError && error.type === ApiErrorType.NOT_FOUND) {
        return null;
      }
      throw error;
    }
  }

  async createInvite(
    email: string,
    role: 'client' | 'partner' | 'driver' | 'warehouse_technician' | 'head_of_operation',
    invitedBy: string,
    tenantId: string,
    tenantName: string
  ): Promise<Invite> {
    const invite = await apiClient.post<Invite>('/invites', {
      email,
      role,
    });
    return invite;
  }

  async listInvites(
    status?: 'pending' | 'accepted' | 'expired',
    role?: 'client' | 'partner' | 'driver' | 'warehouse_technician' | 'head_of_operation'
  ): Promise<Invite[]> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (role) params.append('role', role);
    const queryString = params.toString();
    const invites = await apiClient.get<Invite[]>(`/invites${queryString ? `?${queryString}` : ''}`);
    return invites;
  }

  async cancelInvite(inviteId: string): Promise<void> {
    await apiClient.delete(`/invites/${inviteId}`);
  }

  async logout(): Promise<void> {
    // Call backend logout endpoint to clear httpOnly cookie
    try {
      await apiClient.post('/auth/logout', {});
    } catch (error) {
      // Even if logout fails, clear local state
      console.error('Logout error:', error);
    }
    
    this.currentUser = null;
    this.currentTenant = null;
    apiClient.setCsrfToken(null); // Clear CSRF token on logout
    // No need to clear localStorage - we're not using it anymore
  }

  async getCurrentAuth(): Promise<AuthState | null> {
    // No need to check localStorage - token is in httpOnly cookie
    // Just try to get current user - if cookie is valid, it will work
    
    try {
      // Backend now returns 200 with null user if not authenticated (to avoid console errors)
      const response = await apiClient.get<{ user: User | null; csrfToken?: string }>('/auth/me');
      
      // If user is null, user is not authenticated
      if (!response.user) {
        this.currentUser = null;
        this.currentTenant = null;
        apiClient.setCsrfToken(null); // Clear CSRF token
        return null;
      }
      
      const user = response.user;
      
      // Store CSRF token if provided
      if (response.csrfToken) {
        apiClient.setCsrfToken(response.csrfToken);
      } else {
        // If CSRF token not in response, try to fetch it separately
        // Note: This should rarely happen as getCurrentUser response includes CSRF token if authenticated
        try {
          const csrfResponse = await apiClient.get<{ csrfToken: string | null }>('/auth/csrf-token');
          if (csrfResponse.csrfToken) {
            apiClient.setCsrfToken(csrfResponse.csrfToken);
          }
        } catch (csrfError) {
          // If we can't get CSRF token, it's okay - we'll get it on next POST request
          // Silently handle - 401 is expected if not authenticated
          // Only log in development for debugging
          if (process.env.NODE_ENV === 'development') {
            console.debug('CSRF token not available (will be fetched on next request)');
          }
        }
      }
      
      // Get tenant info (would be included in response in real implementation)
      // For now, we'll need to get it from the user object or make another call
      const tenant: Tenant = {
        id: user.tenantId,
        name: user.tenantName,
        slug: user.tenantId, // Would come from backend
        createdAt: user.createdAt,
      };

      this.currentUser = user;
      this.currentTenant = tenant;

      return {
        user,
        tenant,
        token: null, // Token is in httpOnly cookie, not accessible to JavaScript
        isAuthenticated: true,
      };
    } catch (error) {
      // If any error occurs, clear local state
      // Backend should return 200 with null user, but handle errors just in case
      this.currentUser = null;
      this.currentTenant = null;
      apiClient.setCsrfToken(null); // Clear CSRF token
      return null;
    }
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  getCurrentTenant(): Tenant | null {
    return this.currentTenant;
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await apiClient.post('/auth/change-password', {
      currentPassword,
      newPassword,
    });
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    return apiClient.post<{ message: string }>('/auth/forgot-password', { email });
  }

  async validateResetToken(token: string): Promise<{ valid: boolean }> {
    const params = new URLSearchParams({ token });
    return apiClient.get<{ valid: boolean }>(`/auth/validate-reset-token?${params.toString()}`);
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    return apiClient.post<{ message: string }>('/auth/reset-password', {
      token,
      newPassword,
    });
  }

  async updateProfile(data: {
    name?: string;
    email?: string;
    phone?: string | null;
  }): Promise<User> {
    const response = await apiClient.patch<{ user: User }>('/auth/profile', data);
    this.currentUser = response.user;
    return response.user;
  }
}

export const authService = new AuthService();
