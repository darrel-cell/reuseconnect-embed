import { apiClient } from './api-client';

export interface AuditLogEvent {
  id: string;
  actorUserId?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  actorTenantId?: string | null;
  isSuperAdmin: boolean;
  requestId?: string | null;
  actionType: string;
  entityType: string;
  entityId: string;
  reason?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
  createdAt: string;
}

export const auditService = {
  async list(params?: Record<string, string>) {
    const search = params ? new URLSearchParams(params).toString() : '';
    const path = search ? `/audit-logs?${search}` : '/audit-logs';
    const data = await apiClient.get<AuditLogEvent[] | null>(path);
    return data ?? [];
  },
};
