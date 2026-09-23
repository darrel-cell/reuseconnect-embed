import type { UserRole } from '@/types/auth';

/** Roles that share full admin UI/API access. */
export const ADMIN_EQUIVALENT_ROLES: UserRole[] = ['admin', 'head_of_operation'];

export function isAdminLikeRole(role?: UserRole | string | null): boolean {
  return role === 'admin' || role === 'head_of_operation';
}
