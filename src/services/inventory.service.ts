// Inventory Service
import { ApiError, ApiErrorType } from './api-error';
import { apiClient, type Paginated } from './api-client';

export interface InventoryItem {
  id: string;
  tenantId: string;
  category: string;
  deviceType: string | null; // Windows/Apple for laptop/desktop, null for others
  make: string;
  model: string;
  serialNumber: string;
  imei?: string;
  conditionCode: string;
  erpInventoryId?: string;
  status: 'available' | 'allocated' | 'delivered' | 'mover_allocated' | 'in_transit' | 'collected' | 'warehouse';
  allocatedTo: string | null; // Client ID if allocated
  createdAt: string;
  updatedAt: string;
  lastSyncedAt?: string;
}

export interface InventoryUploadItem {
  category: string;
  deviceType: string | null;
  make: string;
  model: string;
  serialNumber: string;
  imei?: string;
  conditionCode: string;
  status?: string;
}

export interface InventoryUploadResponse {
  created: number;
  updated?: number;
  total: number;
  uniqueTotal?: number;
}

export interface InventorySyncResponse {
  synced: number;
  created: number;
  updated: number;
  errors: string[];
}

export type InventoryLookupResult =
  | { found: false }
  | {
      found: true;
      inventory: {
        id: string;
        category: string;
        deviceType: string | null;
        make: string;
        model: string;
        serialNumber: string;
        imei: string | null;
        conditionCode: string;
        status: string;
      };
      reuse: {
        totalCO2e: number;
        reuseCount: number;
        averageCO2ePerReuse: number;
        firstUseDate: string | null;
        lastUseDate: string | null;
      } | null;
    };

class InventoryService {
  /**
   * A page of inventory, keeping the envelope.
   *
   * `/inventory` had no `take` and returned every row for the tenant. Inventory
   * is the fastest-growing table here — one row per device — so this is the call
   * any screen listing it should use.
   */
  async getInventoryPage(filter?: {
    allocatedTo?: string | null;
    category?: string;
    conditionCode?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<Paginated<InventoryItem>> {
    const params = new URLSearchParams();
    if (filter?.allocatedTo) params.append('allocatedTo', filter.allocatedTo);
    if (filter?.category) params.append('category', filter.category);
    if (filter?.conditionCode) params.append('conditionCode', filter.conditionCode);
    if (filter?.status) params.append('status', filter.status);
    if (filter?.page) params.append('page', String(filter.page));
    if (filter?.limit) params.append('limit', String(filter.limit));
    const qs = params.toString();
    return apiClient.getPaginated<InventoryItem>(`/inventory${qs ? `?${qs}` : ''}`);
  }

  async getInventory(allocatedTo?: string | null): Promise<InventoryItem[]> {
    // For admin, if allocatedTo is null/undefined, don't pass it (shows all inventory)
    // For client users, don't pass allocatedTo (they see their allocated inventory)
    const params = allocatedTo ? `?allocatedTo=${allocatedTo}` : '';
    const response = await apiClient.get<InventoryItem[]>(`/inventory${params}`);
    return response || [];
  }

  async uploadInventory(
    items: InventoryUploadItem[],
    clientId?: string,
    sourceBookingId?: string
  ): Promise<InventoryUploadResponse> {
    const response = await apiClient.post<InventoryUploadResponse>('/inventory/upload', {
      items,
      clientId,
      ...(sourceBookingId ? { sourceBookingId } : {}),
    });
    return response;
  }

  async syncInventory(clientId?: string): Promise<InventorySyncResponse> {
    const response = await apiClient.post<InventorySyncResponse>('/inventory/sync', {
      clientId,
    });
    return response;
  }

  /** Snapshot by serial for grading / manual add (reuse stats when clientId is known). */
  async lookupBySerial(serialNumber: string, clientId?: string): Promise<InventoryLookupResult> {
    const params = new URLSearchParams();
    params.append("serialNumber", serialNumber.trim());
    if (clientId) params.append("clientId", clientId);
    const response = await apiClient.get<InventoryLookupResult>(
      `/inventory/lookup-by-serial?${params.toString()}`
    );
    return response ?? { found: false };
  }

  async getAvailableInventory(allocatedTo: string, category?: string, conditionCode?: string): Promise<InventoryItem[]> {
    const params = new URLSearchParams();
    params.append('allocatedTo', allocatedTo);
    if (category) params.append('category', category);
    if (conditionCode) params.append('conditionCode', conditionCode);

    const response = await apiClient.get<InventoryItem[]>(`/inventory/available?${params.toString()}`);
    return response || [];
  }

  /** Get mover-allocated inventory for a client; pass bookingId to scope devices to one mover booking. */
  async getMoverAllocatedInventory(
    clientId: string,
    bookingId?: string,
    category?: string,
    conditionCode?: string
  ): Promise<InventoryItem[]> {
    const params = new URLSearchParams();
    params.append('clientId', clientId);
    if (bookingId) params.append('bookingId', bookingId);
    if (category) params.append('category', category);
    if (conditionCode) params.append('conditionCode', conditionCode);

    const response = await apiClient.get<InventoryItem[]>(`/inventory/mover-allocated?${params.toString()}`);
    return response || [];
  }

  async updateInventory(id: string, data: {
    make?: string;
    model?: string;
    deviceType?: string | null;
    imei?: string;
    conditionCode?: string;
    status?: string;
  }): Promise<InventoryItem> {
    const response = await apiClient.patch<InventoryItem>(`/inventory/${id}`, data);
    return response;
  }
}

export const inventoryService = new InventoryService();
