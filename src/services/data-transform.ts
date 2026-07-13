// Transform backend data to frontend format
import type { Job, Asset, Driver, Evidence, Certificate } from '@/types/jobs';
import type { WorkflowStatus } from '@/types/jobs';

// Backend job format (from API; clientName removed, organisationName is the company name)
interface BackendJob {
  id: string;
  erpJobNumber: string;
  bookingId?: string | null;
  organisationName: string; // Organisation/company name (from booking.client)
  clientName?: string; // Human client name (from booking.client.name)
  createdByName?: string;
  employeeName?: string;
  siteName: string;
  siteAddress: string;
  status: string; // 'en_route' format
  scheduledDate: string | Date;
  completedDate?: string | Date | null;
  co2eSaved: number;
  travelEmissions: number;
  buybackValue: number;
  costOfServiceBase?: number | null;
  costOfServiceAdjustment?: number;
  costOfServiceTotal?: number | null;
  charityPercent: number;
  roundTripDistanceKm?: number | null; // From booking
  roundTripDistanceMiles?: number | null; // From booking
  bookingType?: 'itad_collection' | 'free_collection' | 'jml'; // From booking
  jmlSubType?: 'new_starter' | 'leaver' | 'breakfix' | 'mover'; // From booking
  // Mover booking specific fields (from booking status history)
  currentAddress?: string;
  currentPostcode?: string;
  currentSiteName?: string;
  currentLat?: number;
  currentLng?: number;
  assets?: BackendJobAsset[];
  driver?: BackendDriver | null;
  evidence?: BackendEvidence[] | BackendEvidence | null; // Can be array (new format) or single object (backward compatibility)
  certificates?: BackendCertificate[];
}

interface BackendJobAsset {
  id: string;
  categoryId: string;
  categoryName: string;
  category?: {
    id: string;
    name: string;
    icon?: string;
  };
  quantity: number;
  serialNumbers?: string[];
  grade?: string | null;
  weight?: number | null;
  sanitised?: boolean;
  wipeMethod?: string | null;
  sanitisationRecordId?: string | null;
  gradingRecordId?: string | null;
  resaleValue?: number | null;
}

interface BackendDriver {
  id: string;
  name: string;
  email?: string;
  role?: string;
  vehicleReg?: string;
  vehicleType?: 'van' | 'truck' | 'car';
  vehicleFuelType?: 'petrol' | 'diesel' | 'electric';
  phone?: string;
  eta?: string;
  isEtaDelayed?: boolean;
}

interface BackendEvidence {
  status?: string; // Status for which this evidence was submitted
  photos: string[];
  signature?: string | null;
  sealNumbers: string[];
  notes?: string | null;
  createdAt?: string | Date;
}

interface BackendCertificate {
  id: string;
  type: string;
  generatedDate: string | Date;
  downloadUrl: string;
  externalUrl?: string | null;
}

/**
 * Transform backend job status to frontend format
 */
function transformStatus(status: string): WorkflowStatus {
  // Convert 'en_route' to 'en-route', etc.
  const statusMap: Record<string, WorkflowStatus> = {
    'booked': 'booked',
    'routed': 'routed',
    'en_route': 'en-route',
    'arrived': 'arrived',
    'collected': 'collected',
    'warehouse': 'warehouse',
    'sanitised': 'sanitised',
    'graded': 'graded',
    'completed': 'completed',
    'cancelled': 'cancelled',
    // JML-specific statuses
    'device_allocated': 'device-allocated',
    'courier_booked': 'courier-booked',
    'dispatched': 'dispatched',
    'delivered': 'delivered',
    'inventory': 'inventory',
    // Mover delivery statuses
    'delivery_courier_booked': 'delivery-courier-booked',
    'delivery_dispatched': 'delivery-dispatched',
  };
  
  return statusMap[status] || status as WorkflowStatus;
}

/**
 * Transform backend job asset to frontend format
 */
function transformAsset(asset: BackendJobAsset): Asset {
  return {
    id: asset.id,
    category: asset.categoryId || asset.category?.id || asset.categoryName, // Prefer categoryId, fallback to categoryName
    categoryId: asset.categoryId || asset.category?.id, // Include categoryId for matching
    categoryName: asset.categoryName || asset.category?.name, // Include categoryName for display
    quantity: asset.quantity,
    serialNumbers: asset.serialNumbers || [],
    grade: asset.grade as Asset['grade'] | undefined,
    weight: asset.weight || undefined,
    sanitised: asset.sanitised || false,
    wipeMethod: asset.wipeMethod || undefined,
    sanitisationRecordId: asset.sanitisationRecordId || undefined,
    gradingRecordId: asset.gradingRecordId || undefined,
    resaleValue: asset.resaleValue || undefined,
  };
}

/**
 * Transform backend driver to frontend format
 */
function transformDriver(driver: BackendDriver | null | undefined): Driver | undefined {
  if (!driver) return undefined;
  
  return {
    id: driver.id,
    name: driver.name,
    vehicleReg: driver.vehicleReg || 'N/A',
    vehicleType: driver.vehicleType || 'van',
    vehicleFuelType: driver.vehicleFuelType || 'diesel',
    phone: driver.phone || driver.email || 'N/A',
    eta: driver.eta,
    isEtaDelayed: driver.isEtaDelayed,
  };
}

/**
 * Transform backend evidence to frontend format
 * Handles both array (new format) and single object (backward compatibility)
 */
function transformEvidence(evidence: BackendEvidence[] | BackendEvidence | null | undefined): Evidence[] | Evidence | undefined {
  
  if (!evidence) return undefined;
  
  // If it's an array, transform each item
  if (Array.isArray(evidence)) {
    const transformed = evidence.map((ev) => ({
      status: ev.status,
      photos: ev.photos || [],
      signature: ev.signature || undefined,
      sealNumbers: ev.sealNumbers || [],
      notes: ev.notes || undefined,
      createdAt: ev.createdAt 
        ? (typeof ev.createdAt === 'string' ? ev.createdAt : ev.createdAt.toISOString())
        : undefined,
    }));
    
    
    return transformed;
  }
  
  // Single object (backward compatibility)
  const transformed = {
    status: evidence.status,
    photos: evidence.photos || [],
    signature: evidence.signature || undefined,
    sealNumbers: evidence.sealNumbers || [],
    notes: evidence.notes || undefined,
    createdAt: evidence.createdAt 
      ? (typeof evidence.createdAt === 'string' ? evidence.createdAt : evidence.createdAt.toISOString())
      : undefined,
  };
  
  
  return transformed;
}

/**
 * Transform backend certificate to frontend format
 */
function transformCertificate(cert: BackendCertificate): Certificate {
  const typeMap: Record<string, Certificate['type']> = {
    'chain_of_custody': 'chain-of-custody',
    'data_wipe': 'data-wipe',
    'destruction': 'destruction',
    'recycling': 'recycling',
    'esg_report': 'recycling', // Default
  };
  
  return {
    type: typeMap[cert.type] || 'chain-of-custody',
    generatedDate: typeof cert.generatedDate === 'string' 
      ? cert.generatedDate 
      : cert.generatedDate.toISOString(),
    downloadUrl: cert.downloadUrl,
  };
}

/**
 * Transform backend job to frontend format
 */
export function transformJob(backendJob: BackendJob): Job {
  const transformedEvidence = transformEvidence(backendJob.evidence);
  
  return {
    id: backendJob.id,
    erpJobNumber: backendJob.erpJobNumber,
    bookingId: backendJob.bookingId || undefined,
    organisationName: backendJob.organisationName,
    clientName: backendJob.clientName,
    createdByName: backendJob.createdByName,
    employeeName: backendJob.employeeName,
    siteName: backendJob.siteName,
    siteAddress: backendJob.siteAddress,
    status: transformStatus(backendJob.status),
    scheduledDate: typeof backendJob.scheduledDate === 'string'
      ? backendJob.scheduledDate
      : backendJob.scheduledDate.toISOString(),
    completedDate: backendJob.completedDate
      ? (typeof backendJob.completedDate === 'string'
          ? backendJob.completedDate
          : backendJob.completedDate.toISOString())
      : undefined,
    assets: (backendJob.assets || []).map(transformAsset),
    driver: transformDriver(backendJob.driver),
    co2eSaved: backendJob.co2eSaved,
    travelEmissions: backendJob.travelEmissions,
    buybackValue: backendJob.buybackValue,
    costOfServiceBase:
      backendJob.costOfServiceBase != null && Number.isFinite(backendJob.costOfServiceBase)
        ? backendJob.costOfServiceBase
        : null,
    costOfServiceAdjustment:
      typeof backendJob.costOfServiceAdjustment === 'number' &&
      Number.isFinite(backendJob.costOfServiceAdjustment)
        ? backendJob.costOfServiceAdjustment
        : 0,
    costOfServiceTotal:
      backendJob.costOfServiceTotal != null &&
      Number.isFinite(backendJob.costOfServiceTotal)
        ? backendJob.costOfServiceTotal
        : null,
    charityPercent: backendJob.charityPercent,
    roundTripDistanceKm: backendJob.roundTripDistanceKm ?? undefined,
    roundTripDistanceMiles: backendJob.roundTripDistanceMiles ?? undefined,
    bookingType: backendJob.bookingType || 'itad_collection',
    jmlSubType: backendJob.jmlSubType || undefined,
    // Mover booking specific fields
    currentAddress: backendJob.currentAddress,
    currentPostcode: backendJob.currentPostcode,
    currentSiteName: backendJob.currentSiteName,
    currentLat: backendJob.currentLat,
    currentLng: backendJob.currentLng,
    evidence: transformedEvidence as Evidence[] | Evidence | undefined,
    certificates: (backendJob.certificates || []).map(transformCertificate),
  };
}

/**
 * Transform array of backend jobs to frontend format
 */
export function transformJobs(backendJobs: BackendJob[]): Job[] {
  return backendJobs.map(transformJob);
}

