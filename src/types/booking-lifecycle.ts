export type BookingTypeForWorkflow = 'itad_collection' | 'free_collection' | 'jml';

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
  | 'pending'       // Booking submitted by client/reseller, awaiting admin approval
  | 'created'       // Booking approved by admin, now active
  | 'scheduled'     // Admin has scheduled and assigned driver
  | 'collected'     // Driver has collected assets
  | 'warehouse'     // Assets at warehouse (ITAD and Leaver)
  | 'sanitised'     // Admin/Ops have sanitised assets
  | 'graded'        // Admin/Ops have graded assets
  | 'completed'     // Final state - all processes complete
  | 'device_allocated'  // JML: Device allocated from inventory
  | 'courier_booked'    // JML: Courier booked
  | 'dispatched'        // JML: Courier picked up package
  | 'delivered'         // JML: Delivered
  | 'collection_scheduled' // JML: Collection scheduled
  | 'inventory'          // Leaver: Added to inventory (handles both reuse and disposal)

export const lifecycleTransitions: Record<BookingLifecycleStatus, (BookingLifecycleStatus | 'cancelled')[]> = {
  pending: ['created', 'cancelled', 'device_allocated'], // JML can go to device_allocated
  created: ['scheduled', 'cancelled', 'device_allocated', 'collection_scheduled'], // JML can go directly to device_allocated or collection_scheduled
  scheduled: ['collected', 'cancelled', 'courier_booked'], // ITAD: collected, JML can go to courier_booked
  collected: ['sanitised', 'warehouse', 'dispatched'], // ITAD: sanitised, Leaver: warehouse, New-starter/Mover: dispatched
  warehouse: ['sanitised', 'inventory'], // ITAD/Leaver: sanitised; Mover uses type-specific warehouse → graded (no sanitised)
  sanitised: ['graded'],
  graded: ['completed', 'inventory'], // ITAD: completed, Leaver/Breakfix: inventory
  inventory: ['completed', 'device_allocated'], // Added to inventory (handles both reuse and disposal), Mover: device_allocated
  completed: [], // Terminal state
  device_allocated: ['courier_booked', 'cancelled'],
  courier_booked: ['dispatched', 'cancelled'],
  dispatched: ['delivered', 'collected', 'cancelled'], // JML: delivered (for deliveries), collected (for collections)
  delivered: ['completed', 'collected'], // JML new starter/mover/breakfix outbound - ticket closed, Breakfix: collected
  collection_scheduled: ['collected', 'cancelled'], // JML leaver/mover - collection scheduled
};

export const roleTransitionPermissions: Record<string, BookingLifecycleStatus[]> = {
  admin: ['scheduled', 'sanitised', 'graded', 'completed', 'inventory', 'device_allocated', 'courier_booked'],
  client: [], // Clients cannot change booking status
  partner: [], // Partners cannot change booking status
  driver: ['collected'], // Drivers can only mark as collected
};

/**
 * Check if a status transition is valid
 */
export function isValidTransition(
  from: BookingLifecycleStatus,
  to: BookingLifecycleStatus
): boolean {
  // Allow same status (no-op)
  if (from === to) return true;
  
  const allowed = lifecycleTransitions[from] || [];
  return allowed.includes(to);
}

/**
 * Check if a role can perform a status transition
 */
export function canRoleTransition(
  role: string,
  to: BookingLifecycleStatus
): boolean {
  const allowed = roleTransitionPermissions[role] || [];
  return allowed.includes(to);
}

/**
 * Get next valid statuses for a given current status
 */
export function getNextValidStatuses(
  current: BookingLifecycleStatus
): (BookingLifecycleStatus | 'cancelled')[] {
  return lifecycleTransitions[current] || [];
}

/**
 * Get status label for display
 */
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

/**
 * Get status color for UI (text + background)
 */
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

/**
 * Get status label for display (including cancelled)
 */
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

