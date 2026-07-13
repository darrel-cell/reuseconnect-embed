// UI Constants and Configuration
// These are UI-level constants, not mock data

import type { WorkflowStatus } from '@/types/jobs';
import { isItadCollectionWorkflow } from '@/types/booking-lifecycle';

export const statusConfig: Record<WorkflowStatus, { label: string; color: string; bgColor: string }> = {
  'booked': { label: 'Booked', color: 'text-info', bgColor: 'bg-info/10' },
  'routed': { label: 'Routed', color: 'text-accent-foreground', bgColor: 'bg-accent/20' },
  'en-route': { label: 'En Route', color: 'text-warning-foreground', bgColor: 'bg-warning/20' },
  'arrived': { label: 'Arrived', color: 'text-warning-foreground', bgColor: 'bg-warning/20' },
  'collected': { label: 'Collected', color: 'text-primary', bgColor: 'bg-primary/10' },
  'warehouse': { label: 'At Warehouse', color: 'text-secondary-foreground', bgColor: 'bg-secondary' },
  'sanitised': { label: 'Sanitised', color: 'text-primary', bgColor: 'bg-primary/15' },
  'graded': { label: 'Graded', color: 'text-success', bgColor: 'bg-success/15' },
  'completed': { label: 'Completed', color: 'text-success-foreground', bgColor: 'bg-success/20' },
  'cancelled': { label: 'Cancelled', color: 'text-muted-foreground', bgColor: 'bg-muted/20' },
  // JML-specific statuses
  'device-allocated': { label: 'Device Allocated', color: 'text-blue-600', bgColor: 'bg-blue-500/20' },
  'courier-booked': { label: 'Courier Booked', color: 'text-purple-600', bgColor: 'bg-purple-500/20' },
  'dispatched': { label: 'Dispatched', color: 'text-orange-600', bgColor: 'bg-orange-500/20' },
  'delivered': { label: 'Delivered', color: 'text-green-600', bgColor: 'bg-green-500/20' },
  'inventory': { label: 'Inventory', color: 'text-green-600', bgColor: 'bg-green-500/20' },
  // Mover delivery statuses
  'delivery-courier-booked': { label: 'Delivery Courier Booked', color: 'text-purple-600', bgColor: 'bg-purple-500/20' },
  'delivery-dispatched': { label: 'Delivery Dispatched', color: 'text-orange-600', bgColor: 'bg-orange-500/20' },
};

/**
 * Get workflow status color (text + background) - similar to booking status colors
 */
export function getWorkflowStatusColor(status: WorkflowStatus): string {
  const colors: Record<WorkflowStatus, string> = {
    'booked': 'bg-info/10 text-info',
    'routed': 'bg-accent/10 text-accent',
    'en-route': 'bg-warning/10 text-warning',
    'arrived': 'bg-warning/10 text-warning',
    'collected': 'bg-primary/10 text-primary',
    'warehouse': 'bg-secondary text-secondary-foreground',
    'sanitised': 'bg-accent/10 text-accent',
    'graded': 'bg-success/10 text-success',
    'completed': 'bg-success/20 text-success',
    'cancelled': 'bg-muted/10 text-muted-foreground',
    // JML-specific statuses
    'device-allocated': 'bg-blue-500/10 text-blue-600',
    'courier-booked': 'bg-purple-500/10 text-purple-600',
    'dispatched': 'bg-orange-500/10 text-orange-600',
    'delivered': 'bg-green-500/10 text-green-600',
    'inventory': 'bg-green-500/10 text-green-600',
    // Mover delivery statuses
    'delivery-courier-booked': 'bg-purple-500/10 text-purple-600',
    'delivery-dispatched': 'bg-orange-500/10 text-orange-600',
  };
  return colors[status];
}

/**
 * Get workflow status label for display
 */
export function getWorkflowStatusLabel(
  status: WorkflowStatus,
  bookingType?: string | null
): string {
  if (status === 'sanitised' && isItadCollectionWorkflow(bookingType)) {
    return 'ITAD Processing In Progress';
  }
  return statusConfig[status].label;
}

// CO2e equivalencies for visualisation (UI constants)
export const co2eEquivalencies = {
  treesPlanted: (kg: number) => Math.round(kg / 21), // 1 tree absorbs ~21kg CO2/year
  householdDays: (kg: number) => Math.round(kg / 27), // UK household ~27kg CO2/day
  carMiles: (kg: number) => Math.round(kg / 0.21), // ~0.21kg CO2 per mile
  flightHours: (kg: number) => Math.round(kg / 250), // ~250kg CO2 per flight hour
};

