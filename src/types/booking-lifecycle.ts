/**
 * Frontend mirror of backend `middleware/workflow.ts` booking transitions.
 * Backend remains authoritative for validation; these helpers are for UI only.
 */

export type BookingTypeForWorkflow = 'itad_collection' | 'free_collection' | 'jml';
export type JmlSubTypeForWorkflow = 'new_starter' | 'leaver' | 'mover' | 'breakfix';

export function isItadCollectionWorkflow(
  bookingType?: BookingTypeForWorkflow | string | null
): boolean {
  return !bookingType || bookingType === 'itad_collection';
}

export function getSanitisedTimelineStep(bookingType?: BookingTypeForWorkflow | string | null): {
  label: string;
  description: string;
} {
  if (isItadCollectionWorkflow(bookingType)) {
    return {
      label: 'ITAD Processing In Progress',
      description: 'Assets being processed at the ITAD facility',
    };
  }
  return {
    label: 'Sanitised',
    description: 'Data sanitisation completed',
  };
}

export type BookingLifecycleStatus =
  | 'pending'
  | 'created'
  | 'scheduled'
  | 'collected'
  | 'warehouse'
  | 'sanitised'
  | 'graded'
  | 'completed'
  | 'device_allocated'
  | 'courier_booked'
  | 'dispatched'
  | 'delivered'
  | 'collection_scheduled'
  | 'inventory';

type BookingTransitions = Partial<
  Record<BookingLifecycleStatus, (BookingLifecycleStatus | 'cancelled')[]>
>;

type WorkflowKey =
  | 'itad_collection:default'
  | 'free_collection:default'
  | 'jml:new_starter'
  | 'jml:leaver'
  | 'jml:mover'
  | 'jml:breakfix';

/** Matches backend BOOKING_WORKFLOWS. */
const BOOKING_WORKFLOWS: Record<WorkflowKey, BookingTransitions> = {
  'itad_collection:default': {
    pending: ['created', 'cancelled'],
    created: ['scheduled', 'cancelled'],
    scheduled: ['collected', 'cancelled'],
    collected: ['warehouse'],
    warehouse: ['sanitised'],
    sanitised: ['graded'],
    graded: ['completed'],
  },
  'free_collection:default': {
    pending: ['created', 'cancelled'],
    created: ['collection_scheduled', 'cancelled'],
    collection_scheduled: ['collected', 'cancelled'],
    collected: ['warehouse'],
    warehouse: ['sanitised'],
    sanitised: ['graded'],
    graded: ['inventory'],
    inventory: ['completed'],
  },
  'jml:new_starter': {
    pending: ['created', 'cancelled', 'device_allocated'],
    created: ['device_allocated', 'cancelled'],
    device_allocated: ['courier_booked', 'cancelled'],
    courier_booked: ['dispatched', 'cancelled'],
    dispatched: ['delivered', 'cancelled'],
    delivered: ['completed'],
  },
  'jml:leaver': {
    pending: ['created', 'cancelled'],
    created: ['collection_scheduled', 'cancelled'],
    collection_scheduled: ['collected', 'cancelled'],
    collected: ['warehouse'],
    warehouse: ['sanitised'],
    sanitised: ['graded'],
    graded: ['inventory'],
    inventory: ['completed'],
  },
  'jml:mover': {
    pending: ['created', 'cancelled'],
    created: ['collection_scheduled', 'cancelled'],
    collection_scheduled: ['collected', 'cancelled'],
    collected: ['warehouse'],
    warehouse: ['graded'],
    graded: ['inventory'],
    inventory: ['device_allocated'],
    device_allocated: ['courier_booked', 'cancelled'],
    courier_booked: ['dispatched', 'cancelled'],
    dispatched: ['delivered', 'cancelled'],
    delivered: ['completed'],
  },
  'jml:breakfix': {
    pending: ['created', 'cancelled', 'device_allocated'],
    created: ['device_allocated', 'cancelled'],
    device_allocated: ['courier_booked', 'cancelled'],
    courier_booked: ['dispatched', 'cancelled'],
    dispatched: ['delivered', 'cancelled'],
    delivered: ['collected'],
    collected: ['warehouse'],
    warehouse: ['sanitised'],
    sanitised: ['graded'],
    graded: ['inventory'],
    inventory: ['completed'],
  },
};

function workflowKey(
  bookingType?: BookingTypeForWorkflow | string | null,
  jmlSubType?: JmlSubTypeForWorkflow | string | null
): WorkflowKey {
  if (bookingType === 'jml') {
    return `jml:${(jmlSubType as JmlSubTypeForWorkflow) || 'new_starter'}` as WorkflowKey;
  }
  if (bookingType === 'free_collection') return 'free_collection:default';
  return 'itad_collection:default';
}

/**
 * Union of all type-specific edges — useful for coarse UI checks only.
 * Prefer `isValidTransition(..., bookingType, jmlSubType)`.
 */
export const lifecycleTransitions: Record<
  BookingLifecycleStatus,
  (BookingLifecycleStatus | 'cancelled')[]
> = (() => {
  const union = {} as Record<BookingLifecycleStatus, Set<BookingLifecycleStatus | 'cancelled'>>;
  const statuses: BookingLifecycleStatus[] = [
    'pending',
    'created',
    'scheduled',
    'collected',
    'warehouse',
    'sanitised',
    'graded',
    'completed',
    'device_allocated',
    'courier_booked',
    'dispatched',
    'delivered',
    'collection_scheduled',
    'inventory',
  ];
  for (const s of statuses) union[s] = new Set();
  for (const map of Object.values(BOOKING_WORKFLOWS)) {
    for (const [from, tos] of Object.entries(map)) {
      for (const to of tos || []) {
        union[from as BookingLifecycleStatus].add(to);
      }
    }
  }
  const result = {} as Record<BookingLifecycleStatus, (BookingLifecycleStatus | 'cancelled')[]>;
  for (const s of statuses) result[s] = Array.from(union[s]);
  return result;
})();

/** Statuses each role may set via UI helpers. Backend authorize() remains authoritative. */
export const roleTransitionPermissions: Record<string, BookingLifecycleStatus[]> = {
  admin: [
    'scheduled',
    'collection_scheduled',
    'warehouse',
    'sanitised',
    'graded',
    'inventory',
    'completed',
    'device_allocated',
    'courier_booked',
    'dispatched',
    'delivered',
    'collected',
  ],
  head_of_operation: [
    'scheduled',
    'collection_scheduled',
    'warehouse',
    'sanitised',
    'graded',
    'inventory',
    'completed',
    'device_allocated',
    'courier_booked',
  ],
  warehouse_technician: ['warehouse', 'sanitised', 'graded', 'inventory'],
  client: [],
  partner: [],
  // Drivers advance collection via the job status API, not booking status.
  driver: [],
};

export function isValidTransition(
  from: BookingLifecycleStatus,
  to: BookingLifecycleStatus | 'cancelled',
  bookingType?: BookingTypeForWorkflow | string | null,
  jmlSubType?: JmlSubTypeForWorkflow | string | null
): boolean {
  if (from === to) return true;
  if (bookingType) {
    const key = workflowKey(bookingType, jmlSubType);
    const allowed = BOOKING_WORKFLOWS[key]?.[from] || [];
    return allowed.includes(to);
  }
  const allowed = lifecycleTransitions[from] || [];
  return allowed.includes(to);
}

export function canRoleTransition(role: string, to: BookingLifecycleStatus): boolean {
  const allowed = roleTransitionPermissions[role] || [];
  return allowed.includes(to);
}

export function getNextValidStatuses(
  current: BookingLifecycleStatus,
  bookingType?: BookingTypeForWorkflow | string | null,
  jmlSubType?: JmlSubTypeForWorkflow | string | null
): (BookingLifecycleStatus | 'cancelled')[] {
  if (bookingType) {
    const key = workflowKey(bookingType, jmlSubType);
    return BOOKING_WORKFLOWS[key]?.[current] || [];
  }
  return lifecycleTransitions[current] || [];
}

/** True when this booking type must pass through inventory before completed. */
export function requiresInventoryBeforeComplete(
  bookingType?: BookingTypeForWorkflow | string | null,
  jmlSubType?: JmlSubTypeForWorkflow | string | null
): boolean {
  if (bookingType === 'free_collection') return true;
  if (bookingType === 'jml') {
    return jmlSubType === 'leaver' || jmlSubType === 'breakfix' || jmlSubType === 'mover';
  }
  return false;
}

export function getStatusLabel(status: BookingLifecycleStatus): string {
  const labels: Record<BookingLifecycleStatus, string> = {
    pending: 'Pending',
    created: 'Created',
    scheduled: 'Scheduled',
    collected: 'Collected',
    warehouse: 'At Warehouse',
    sanitised: 'Sanitised',
    graded: 'Graded',
    completed: 'Completed',
    device_allocated: 'Device Allocated',
    courier_booked: 'Courier Booked',
    dispatched: 'Dispatched',
    delivered: 'Delivered',
    collection_scheduled: 'Collection Scheduled',
    inventory: 'Inventory',
  };
  return labels[status] || status;
}

export function getStatusColor(status: BookingLifecycleStatus | 'cancelled'): string {
  const colors: Record<BookingLifecycleStatus | 'cancelled', string> = {
    pending: 'bg-warning/10 text-warning',
    created: 'bg-info/10 text-info',
    scheduled: 'bg-warning/10 text-warning',
    collected: 'bg-primary/10 text-primary',
    warehouse: 'bg-secondary-foreground/10 text-secondary-foreground',
    sanitised: 'bg-accent/10 text-accent',
    graded: 'bg-success/10 text-success',
    completed: 'bg-success/20 text-success',
    cancelled: 'bg-destructive/10 text-destructive',
    device_allocated: 'bg-blue-500/10 text-blue-500',
    courier_booked: 'bg-purple-500/10 text-purple-500',
    dispatched: 'bg-orange-500/10 text-orange-500',
    delivered: 'bg-green-500/10 text-green-500',
    collection_scheduled: 'bg-cyan-500/10 text-cyan-500',
    inventory: 'bg-green-500/10 text-green-500',
  };
  return colors[status] || 'bg-gray-500/10 text-gray-500';
}

export function getStatusLabelExtended(
  status: BookingLifecycleStatus | 'cancelled',
  bookingType?: BookingTypeForWorkflow | string | null
): string {
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'sanitised' && isItadCollectionWorkflow(bookingType)) {
    return 'ITAD Processing In Progress';
  }
  return getStatusLabel(status);
}
