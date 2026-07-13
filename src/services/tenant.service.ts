/**
 * Tenant Service - Loads tenant configuration based on subdomain
 */
import type { Tenant } from '@/types/auth';
import { getSubdomain, getResellerSlug, isAdminSubdomain } from '@/lib/subdomain';
import { delay, shouldSimulateError, ApiError, ApiErrorType } from './api-error';

const SERVICE_NAME = 'tenant';

// Mock tenants with subdomain slugs
const mockTenants: Tenant[] = [
  {
    id: 'tenant-1',
    name: 'Reuse Connect ITAD Platform',
    slug: 'admin', // Admin subdomain
    logo: '/logo.avif',
    favicon: '/favicon.avif',
    primaryColor: '168, 70%, 35%',
    accentColor: '168, 60%, 45%',
    theme: 'auto',
    createdAt: '2024-01-01',
  },
  {
    id: 'tenant-2',
    name: 'TechCorp Industries',
    slug: 'techcorp', // Reseller subdomain
    logo: '/logo.avif', // Would be custom logo in production
    favicon: '/favicon.ico', // Would be custom favicon in production
    primaryColor: '221, 83%, 53%',
    accentColor: '221, 73%, 63%',
    theme: 'light',
    createdAt: '2024-01-15',
  },
  {
    id: 'tenant-3',
    name: 'Partner Solutions',
    slug: 'partner', // Reseller subdomain
    logo: '/logo.avif', // Would be custom logo in production
    favicon: '/favicon.ico', // Would be custom favicon in production
    primaryColor: '280, 70%, 50%',
    accentColor: '280, 60%, 60%',
    theme: 'light',
    createdAt: '2024-02-01',
  },
];

class TenantService {
  /**
   * Load tenant configuration based on current subdomain
   * This is called on app initialization to set up white-label branding
   */
  async getTenantBySubdomain(): Promise<Tenant | null> {
    await delay(500); // Simulate API call

    if (shouldSimulateError(SERVICE_NAME) && Math.random() < 0.1) {
      const config = JSON.parse(localStorage.getItem(`error_sim_${SERVICE_NAME}`) || '{}');
      throw new ApiError(
        config.errorType || ApiErrorType.NETWORK_ERROR,
        'Failed to load tenant configuration',
        config.errorType === ApiErrorType.NETWORK_ERROR ? 0 : 500
      );
    }

    const subdomain = getSubdomain();

    // Admin subdomain
    if (isAdminSubdomain()) {
      return mockTenants.find(t => t.slug === 'admin') || null;
    }

    // Reseller subdomain
    const resellerSlug = getResellerSlug();
    if (resellerSlug) {
      const tenant = mockTenants.find(t => t.slug === resellerSlug);
      if (tenant) {
        return tenant;
      }
      // If reseller not found, return a default reseller tenant
      // In production, this would fetch from API
      return {
        id: `tenant-${resellerSlug}`,
        name: `${resellerSlug.charAt(0).toUpperCase() + resellerSlug.slice(1)} Partner`,
        slug: resellerSlug,
        logo: '/logo.avif',
        favicon: '/favicon.ico',
        primaryColor: '168, 70%, 35%',
        accentColor: '168, 60%, 45%',
        theme: 'auto',
        createdAt: new Date().toISOString(),
      };
    }

    // No subdomain - default to admin/platform
    return mockTenants.find(t => t.slug === 'admin') || null;
  }

  /**
   * Get tenant by slug (for testing or direct access)
   */
  async getTenantBySlug(slug: string): Promise<Tenant | null> {
    await delay(300);
    return mockTenants.find(t => t.slug === slug) || null;
  }

  /**
   * Get all tenants (admin only)
   */
  async getAllTenants(): Promise<Tenant[]> {
    await delay(500);
    return [...mockTenants];
  }

  /**
   * Update tenant branding (for resellers to update their own branding)
   */
  async updateTenantBranding(tenantId: string, branding: {
    logo?: string;
    favicon?: string;
    primaryColor?: string;
    accentColor?: string;
  }): Promise<Tenant> {
    await delay(800);

    if (shouldSimulateError(SERVICE_NAME)) {
      const config = JSON.parse(localStorage.getItem(`error_sim_${SERVICE_NAME}`) || '{}');
      throw new ApiError(
        config.errorType || ApiErrorType.SERVER_ERROR,
        'Failed to update branding. Please try again.',
        config.errorType === ApiErrorType.NETWORK_ERROR ? 0 : 500
      );
    }

    const tenant = mockTenants.find(t => t.id === tenantId);
    if (!tenant) {
      throw new ApiError(
        ApiErrorType.NOT_FOUND,
        `Tenant with ID "${tenantId}" was not found.`,
        404
      );
    }

    // Update tenant branding
    if (branding.logo !== undefined) tenant.logo = branding.logo;
    if (branding.favicon !== undefined) tenant.favicon = branding.favicon;
    if (branding.primaryColor !== undefined) tenant.primaryColor = branding.primaryColor;
    if (branding.accentColor !== undefined) tenant.accentColor = branding.accentColor;

    return tenant;
  }
}

export const tenantService = new TenantService();

