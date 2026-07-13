// Centralized Permission System
import type { UserRole } from '@/types/auth';

export type Permission = 
  // Job permissions
  | 'jobs.view.all'
  | 'jobs.view.own'
  | 'jobs.view.assigned'
  | 'jobs.create'
  | 'jobs.update.status'
  | 'jobs.update.evidence'
  | 'jobs.view.driver'
  
  // Booking permissions
  | 'bookings.view.all'
  | 'bookings.view.own'
  | 'bookings.view.client'
  | 'bookings.create'
  | 'bookings.create.for.client'
  
  // User management
  | 'users.view.all'
  | 'users.invite'
  | 'users.manage'
  
  // Client management
  | 'clients.view.all'
  | 'clients.view.own'
  | 'clients.manage'
  
  // Reseller permissions
  | 'resellers.view.all'
  | 'resellers.manage'
  
  // Documents
  | 'documents.view.all'
  | 'documents.view.own'
  | 'documents.download'
  
  // Settings
  | 'settings.organisation'
  | 'settings.integrations'
  | 'settings.users'
  | 'settings.security';

// Role-based permission mapping
const rolePermissions: Record<UserRole, Permission[]> = {
  admin: [
    // Jobs
    'jobs.view.all',
    'jobs.create',
    'jobs.update.status',
    'jobs.view.driver',
    
    // Bookings
    'bookings.view.all',
    'bookings.create',
    'bookings.create.for.client',
    
    // User management
    'users.view.all',
    'users.invite',
    'users.manage',
    
    // Client management
    'clients.view.all',
    'clients.manage',
    
    // Reseller management
    'resellers.view.all',
    'resellers.manage',
    
    // Documents
    'documents.view.all',
    'documents.download',
    
    // Settings
    'settings.organisation',
    'settings.integrations',
    'settings.users',
    'settings.security',
  ],

  head_of_operation: [
    // Admin-equivalent permissions
    'jobs.view.all',
    'jobs.create',
    'jobs.update.status',
    'jobs.view.driver',
    'bookings.view.all',
    'bookings.create',
    'bookings.create.for.client',
    'users.view.all',
    'users.invite',
    'users.manage',
    'clients.view.all',
    'clients.manage',
    'resellers.view.all',
    'resellers.manage',
    'documents.view.all',
    'documents.download',
    'settings.organisation',
    'settings.integrations',
    'settings.users',
    'settings.security',
    // Driver-equivalent evidence rights for assigned jobs
    'jobs.view.assigned',
    'jobs.update.evidence',
  ],
  
  client: [
    // Jobs
    'jobs.view.own',
    'jobs.create',
    
    // Bookings
    'bookings.view.own',
    'bookings.create',
    
    // Documents
    'documents.view.own',
    'documents.download',
    
    // Settings
    'settings.organisation',
    'settings.integrations',
    'settings.security',
  ],
  
  partner: [
    // Jobs
    'jobs.view.own',
    'jobs.create',
    
    // Bookings
    'bookings.view.client',
    'bookings.create',
    'bookings.create.for.client',
    
    // Client management
    'clients.view.own',
    'clients.manage',
    
    // Documents
    'documents.view.own',
    'documents.download',
    
    // Settings
    'settings.organisation',
    'settings.integrations',
    'settings.security',
  ],
  
  driver: [
    // Jobs
    'jobs.view.assigned',
    'jobs.update.status',
    'jobs.update.evidence',
    'jobs.view.driver',
  ],

  warehouse_technician: [
    // Jobs
    'jobs.view.assigned',
    'jobs.update.status',
    'jobs.view.driver',
  ],
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return rolePermissions[role]?.includes(permission) ?? false;
}

/**
 * Check if a role has any of the specified permissions
 */
export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some(permission => hasPermission(role, permission));
}

/**
 * Check if a role has all of the specified permissions
 */
export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every(permission => hasPermission(role, permission));
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: UserRole): Permission[] {
  return rolePermissions[role] ?? [];
}

