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
  status: 'active' | 'inactive' | 'pending';
  createdAt: string;
  totalBookings: number;
  totalJobs: number;
  totalValue: number;
}

export interface OrganisationCard {
  tenantId: string;
  tenantName: string;
  domainId: string | null;
  domain: string | null;
  domainVerified: boolean;
  employeeCount: number;
  bookingCount: number;
  jobCount: number;
  resellerName?: string;
  referralNames?: string[];
  statusSummary: Record<string, number>;
  employees: Array<{
    id: string;
    name: string;
    email: string;
    status: string;
    resellerName?: string;
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
  scheduledDate: string;
  status: BookingLifecycleStatus | 'cancelled';
  assets: Array<{
    categoryId: string;
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
