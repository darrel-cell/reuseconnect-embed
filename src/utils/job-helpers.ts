// Helper functions for job-related logic
import type { Job } from '@/types/jobs';

/**
 * Check if a driver can access a job (for driver view)
 * Drivers can only access jobs in statuses they can work on:
 * - booked, routed, en_route (or en-route), arrived, collected, warehouse
 * - They cannot edit jobs in sanitised, graded, completed statuses
 * - But they can view their submitted evidence for those statuses
 */
export function canDriverAccessJob(job: Job | null | undefined): boolean {
  if (!job) return false;
  
  // Normalize the job status for comparison
  const normalizedStatus = normalizeStatusForCheck(job.status);
  
  // Normalize status for consistency
  const normalized = normalizedStatus;
  
  // Drivers can access jobs in these statuses (normalized format)
  const accessibleStatuses = ['booked', 'routed', 'en-route', 'arrived', 'collected', 'warehouse', 'sanitised', 'graded', 'inventory', 'completed'];
  
  return accessibleStatuses.includes(normalized);
}

/**
 * Normalize status for comparison (handle both en-route and en_route, etc.)
 */
function normalizeStatusForCheck(status: string): string {
  if (status === 'en-route' || status === 'en_route') return 'en-route';
  return status;
}

/**
 * Check if a driver can edit a job (submit evidence, update status)
 * Drivers can only edit jobs in statuses they can work on
 * Final driver statuses (non-editable):
 * - ITAD/Leaver: collected (warehouse/admin handles warehouse → sanitised → graded → inventory/completed)
 * - New Starter: arrived (admin handles arrived → completed)
 * - Mover: warehouse (first phase - old device) - delivery phase is courier-based
 * - Breakfix: courier-based workflow - drivers don't handle JML jobs
 * Note: 'booked' is not editable - job must be routed first
 */
export function canDriverEditJob(job: Job | null | undefined): boolean {
  if (!job) return false;
  
  // Normalize the job status for comparison
  const normalizedStatus = normalizeStatusForCheck(job.status);
  
  // Normalize status for consistency
  const normalized = normalizedStatus;
  
  // Base editable statuses (before checking final statuses)
  // 'booked' = approved job awaiting driver start (booking may already be "scheduled")
  const baseEditableStatuses = ['booked', 'routed', 'en-route', 'arrived'];
  
  if (!baseEditableStatuses.includes(normalized)) {
    return false;
  }
  
  // Check if current status is a final driver status (non-editable) based on booking type
  const bookingType = job.bookingType;
  const jmlSubType = job.jmlSubType;
  
  // ITAD and Leaver: warehouse is final driver status
  if ((!bookingType || bookingType === 'itad_collection' || (bookingType === 'jml' && jmlSubType === 'leaver')) && normalized === 'warehouse') {
    return false;
  }
  
  // New Starter: arrived is final driver status
  if (bookingType === 'jml' && jmlSubType === 'new_starter' && normalized === 'arrived') {
    return false;
  }
  
  // Mover: warehouse is final driver status for first phase (old device collection)
  // Drivers don't handle delivery phase for Mover (courier-based)
  if (bookingType === 'jml' && jmlSubType === 'mover') {
    if (normalized === 'warehouse') {
      return false;
    }
  }
  
  // Breakfix: arrived is final driver status for first phase (replacement delivery)
  // Then warehouse is final driver status for second phase (broken device collection)
  if (bookingType === 'jml' && jmlSubType === 'breakfix') {
    if (normalized === 'arrived' || normalized === 'warehouse') {
      return false;
    }
  }
  
  return true;
}

/**
 * Check if a job status is the final driver status for a booking type
 * Final driver statuses:
 * - ITAD/Leaver: collected
 * - New Starter: arrived
 * - Mover: warehouse (first phase) - delivery phase is courier-based
 * - Breakfix: arrived (first phase), warehouse (second phase)
 */
export function isDriverFinalStatus(job: Job | null | undefined, status: string): boolean {
  if (!job) return false;
  
  // Normalize the status for comparison
  const normalizedStatus = normalizeStatusForCheck(status);
  const normalized = normalizedStatus;
  
  const bookingType = job.bookingType;
  const jmlSubType = job.jmlSubType;
  
  // ITAD and Leaver: collected is final driver status
  if ((!bookingType || bookingType === 'itad_collection' || (bookingType === 'jml' && jmlSubType === 'leaver')) && normalized === 'collected') {
    return true;
  }
  
  // New Starter: arrived is final driver status
  if (bookingType === 'jml' && jmlSubType === 'new_starter' && normalized === 'arrived') {
    return true;
  }
  
  // Mover: warehouse (first phase) is final driver status
  // Drivers don't handle delivery phase for Mover (courier-based)
  if (bookingType === 'jml' && jmlSubType === 'mover' && normalized === 'warehouse') {
    return true;
  }
  
  // Breakfix: arrived (first phase) or warehouse (second phase) are final driver statuses
  if (bookingType === 'jml' && jmlSubType === 'breakfix' && (normalized === 'arrived' || normalized === 'warehouse')) {
    return true;
  }
  
  return false;
}
