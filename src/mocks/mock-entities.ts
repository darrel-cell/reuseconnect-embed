import type { User } from '@/types/auth';
import type { BookingLifecycleStatus } from '@/types/booking-lifecycle';

export interface ExtendedUser extends User {
  isActive: boolean;
  status?: 'pending' | 'active' | 'inactive' | 'declined';
  lastLogin?: string;
  invitedBy?: string;
  resellerId?: string;
  resellerName?: string;
}

export interface Client {
  id: string;
  name: string;
  organisationName?: string;
  tenantId: string;
  tenantName: string;
  email: string;
  contactName: string;
  contactPhone: string;
  resellerId?: string;
  resellerName?: string;
  departmentId?: string | null;
  departmentName?: string | null;
  status: 'active' | 'inactive' | 'pending';
  createdAt: string;
  totalBookings: number;
  totalJobs: number;
  totalValue: number;
}

export interface OrganisationCard {
  tenantId: string;
  /** Display name for the card (client organisation name, falling back to tenant name). */
  tenantName: string;
  /** Client's own company name from the Client record, when available. */
  organisationName?: string;
  domainId: string | null;
  domain: string | null;
  domainVerified: boolean;
  employeeCount: number;
  bookingCount: number;
  jobCount: number;
  resellerName?: string;
  referralNames?: string[];
  departmentName?: string;
  departmentNames?: string[];
  statusSummary: Record<string, number>;
  employees: Array<{
    id: string;
    name: string;
    email: string;
    status: string;
    resellerName?: string;
    departmentName?: string;
  }>;
}

export interface Booking {
  id: string;
  bookingNumber: string;
  clientId: string;
  clientName: string;
  organisationName?: string;
  resellerId?: string;
  resellerName?: string;
  siteName: string;
  siteAddress: string;
  /** Collection postcode and coordinates, as stored against the booking. */
  postcode?: string;
  lat?: number;
  lng?: number;
  scheduledDate: string;
  status: BookingLifecycleStatus | 'cancelled';
  /** Status transitions, newest last. Present on single-booking reads. */
  statusHistory?: Array<{
    id: string;
    status: string;
    changedBy?: string;
    notes?: string;
    createdAt: string;
  }>;
  /**
   * Assets on the booking, as the API sends them.
   *
   * `id` and `category` were missing from this type even though the transform
   * has always emitted both, which is why call sites were reaching for
   * `(asset as any).id` to edit a row.
   */
  assets: Array<{
    id?: string;
    categoryId: string;
    /** Same value as `categoryName`; both are sent for backwards compatibility. */
    category?: string;
    categoryName: string;
    quantity: number;
  }>;
  charityPercent: number;
  estimatedCO2e: number;
  estimatedBuyback: number;
  preferredVehicleType?: 'petrol' | 'diesel' | 'electric';
  roundTripDistanceKm?: number;
  roundTripDistanceMiles?: number;
  jobId?: string;
  jobStatus?: string;
  erpJobNumber?: string;
  driverId?: string;
  driverName?: string;
  createdAt: string;
  createdBy: string;
  createdByName?: string;
  scheduledBy?: string;
  scheduledAt?: string;
  collectedAt?: string;
  sanitisedAt?: string;
  gradedAt?: string;
  completedAt?: string;
  notes?: string;
  cancellationNotes?: string;
  // JML fields
  bookingType?: 'itad_collection' | 'free_collection' | 'jml';
  jmlSubType?: 'new_starter' | 'leaver' | 'breakfix' | 'mover';
  employeeName?: string;
  employeeEmail?: string;
  employeePhone?: string;
  startDate?: string;
  deviceType?: string;
  courierTracking?: string;
  courierService?: string;
  collectionCourierTracking?: string;
  collectionCourierService?: string;
  deliveryDate?: string;
  // Mover booking specific fields
  currentAddress?: string;
  currentPostcode?: string;
  currentSiteName?: string;
  currentLat?: number;
  currentLng?: number;
}

export interface SanitisationRecord {
  id: string;
  bookingId: string;
  jobId?: string;
  assetId: string;
  method: 'blancco' | 'physical-destruction' | 'degaussing' | 'shredding' | 'other';
  methodDetails?: string;
  timestamp: string;
  performedBy: string;
  certificateId: string;
  certificateUrl: string;
  verified: boolean;
  notes?: string;
}

export interface GradingRecord {
  id: string;
  bookingId: string;
  jobId?: string;
  assetId: string;
  assetCategory: string;
  grade: 'A' | 'B' | 'C' | 'D' | 'Q';
  quantity: number;
  resaleValue: number;
  gradedAt: string;
  gradedBy: string;
  notes?: string;
  condition?: string;
  serialNumbers?: string[];
  imeiNumbers?: string[];
}
