// Authentication and User Types

export type UserRole =
  | 'admin'
  | 'head_of_operation'
  | 'client'
  | 'partner'
  | 'driver'
  | 'warehouse_technician';
export type UserStatus = 'pending' | 'active' | 'inactive' | 'declined';

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  status?: UserStatus; // New signups start as 'pending', approved users are 'active'
  tenantId: string;
  tenantName: string;
  organisationName?: string;
  avatar?: string;
  isSuperAdmin?: boolean;
  createdAt: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  favicon?: string;
  primaryColor?: string;
  accentColor?: string;
  theme?: 'light' | 'dark' | 'auto';
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  tenant: Tenant | null;
  token: string | null;
  isAuthenticated: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupData {
  email: string;
  password: string;
  name: string;
  companyName: string;
  role?: 'client' | 'partner';
  referralPartnerSlug?: string;
}

export interface InviteData {
  inviteToken: string;
  email: string;
  name: string;
  password: string;
  organisationName?: string;
}

export interface Invite {
  id: string;
  email: string;
  role: UserRole;
  tenantId: string;
  tenantName: string;
  invitedBy: string;
  invitedAt: string;
  expiresAt: string;
  acceptedAt?: string;
  token?: string;
  status?: 'pending' | 'accepted' | 'expired';
  inviter?: {
    id: string;
    name: string;
    email: string;
  };
}

