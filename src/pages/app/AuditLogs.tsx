import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { auditService } from '@/services/audit.service';
import { useAuth } from '@/contexts/auth-context';

export default function AuditLogs() {
  const { user } = useAuth();
  const [actionType, setActionType] = useState('');
  const [entityType, setEntityType] = useState('');

  const queryParams = useMemo(() => {
    const params: Record<string, string> = {};
    if (actionType.trim()) params.actionType = actionType.trim();
    if (entityType.trim()) params.entityType = entityType.trim();
    return params;
  }, [actionType, entityType]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['audit-logs', queryParams],
    queryFn: () => auditService.list(queryParams),
    enabled: !!user?.isSuperAdmin,
  });

  if (!user?.isSuperAdmin) {
    return <div className="p-6">Super admin access required.</div>;
  }

  return (
    <div className="p-6 space-y-4" data-main-content>
      <p className="text-sm text-muted-foreground">
        Track who changed what, when, and why.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input
          className="border rounded px-3 py-2"
          placeholder="Filter by action type"
          value={actionType}
          onChange={(e) => setActionType(e.target.value)}
        />
        <input
          className="border rounded px-3 py-2"
          placeholder="Filter by entity type"
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
        />
      </div>

      {isLoading && <div>Loading audit logs...</div>}
      {error && <div className="text-destructive">Failed to load audit logs.</div>}

      {!isLoading && !error && (
        <div className="border rounded overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-2">Timestamp</th>
                <th className="text-left p-2">Performed By</th>
                <th className="text-left p-2">Action</th>
                <th className="text-left p-2">Target Entity</th>
                <th className="text-left p-2">Reason</th>
              </tr>
            </thead>
            <tbody>
              {(data || []).map((event) => (
                <tr key={event.id} className="border-t">
                  <td className="p-2">{new Date(event.createdAt).toLocaleString()}</td>
                  <td className="p-2">{event.actorEmail || event.actorUserId || 'system'}</td>
                  <td className="p-2">{event.actionType}</td>
                  <td className="p-2">{event.entityType}:{event.entityId}</td>
                  <td className="p-2">{event.reason || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
