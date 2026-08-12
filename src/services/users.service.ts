// Users Service (for admin user management)
import type { ExtendedUser } from '@/mocks/mock-entities';

export interface UserListFilter {
  role?: string;
  tenantId?: string;
  isActive?: boolean;
  status?: string;
  page?: number;
  limit?: number;
}
import { ApiError } from './api-error';
import { apiClient, type Paginated } from './api-client';

class UsersService {
  async updateUser(
    userId: string,
    data: Partial<{
      name: string;
      email: string;
      phone: string | null;
      role: 'admin' | 'head_of_operation' | 'client' | 'partner' | 'driver' | 'warehouse_technician';
    }>
  ): Promise<ExtendedUser> {
    return apiClient.patch<ExtendedUser>(`/users/${userId}`, data);
  }

  async createUser(data: {
    role: 'admin' | 'head_of_operation' | 'client' | 'partner' | 'driver' | 'warehouse_technician';
    name: string;
    email: string;
    password: string;
    phone?: string;
    organisationName: string;
    registrationNumber?: string;
  }): Promise<ExtendedUser> {
    return apiClient.post<ExtendedUser>('/users', data);
  }

  async resetUserPassword(userId: string, password?: string): Promise<{ userId: string; email: string; password: string }> {
    return apiClient.patch<{ userId: string; email: string; password: string }>(`/users/${userId}/reset-password`, {
      password,
    });
  }

  /** Page of users, keeping the pagination envelope. */
  async getUsersPage(filter?: UserListFilter): Promise<Paginated<ExtendedUser>> {
    const params = new URLSearchParams();
    if (filter?.role) params.append('role', filter.role);
    if (filter?.status) params.append('status', filter.status);
    if (filter?.tenantId) params.append('tenantId', filter.tenantId);
    if (filter?.isActive !== undefined) params.append('isActive', String(filter.isActive));
    if (filter?.page) params.append('page', String(filter.page));
    if (filter?.limit) params.append('limit', String(filter.limit));
    const qs = params.toString();
    return apiClient.getPaginated<ExtendedUser>(`/users${qs ? `?${qs}` : ''}`);
  }

  async getUsers(filter?: UserListFilter): Promise<ExtendedUser[]> {
    const params = new URLSearchParams();
    if (filter?.role) {
      params.append('role', filter.role);
    }
    if (filter?.status) {
      params.append('status', filter.status);
    }
    if (filter?.tenantId) {
      params.append('tenantId', filter.tenantId);
    }
    if (filter?.isActive !== undefined) {
      params.append('isActive', filter.isActive.toString());
    }

    const queryString = params.toString();
    const endpoint = `/users${queryString ? `?${queryString}` : ''}`;
    
    const users = await apiClient.get<ExtendedUser[]>(endpoint);
    return users;
  }

  async getUser(id: string): Promise<ExtendedUser | null> {
    try {
      const user = await apiClient.get<ExtendedUser>(`/users/${id}`);
      return user || null;
    } catch (error) {
      // Same `statusCode` slip as clients.service had; `error: any` hid it from tsc.
      if (error instanceof ApiError && error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  async updateUserStatus(userId: string, statusOrIsActive: 'pending' | 'active' | 'inactive' | boolean): Promise<ExtendedUser> {
    // Support both status string and isActive boolean for backward compatibility
    let status: 'pending' | 'active' | 'inactive';
    
    if (typeof statusOrIsActive === 'boolean') {
      // Convert boolean to status: true -> 'active', false -> 'inactive'
      status = statusOrIsActive ? 'active' : 'inactive';
    } else {
      status = statusOrIsActive;
    }
    
    const user = await apiClient.patch<ExtendedUser>(`/users/${userId}/status`, { status });
    return user;
  }

  async deleteUser(userId: string, reason: string): Promise<void> {
    await apiClient.delete(`/users/${userId}`, { reason });
  }

  async approveUser(userId: string): Promise<ExtendedUser> {
    const user = await apiClient.patch<ExtendedUser>(`/users/${userId}/approve`, {});
    return user;
  }

  async declineUser(userId: string): Promise<ExtendedUser> {
    const user = await apiClient.patch<ExtendedUser>(`/users/${userId}/decline`, {});
    return user;
  }
}

export const usersService = new UsersService();
