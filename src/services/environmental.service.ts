// RTG environmental impact (water, minerals and CO2e avoided): the dashboard's figures.
import { apiClient } from './api-client';

export type QuarantineTreatment = 'reuse' | 'recycle' | 'exclude';
export type EquivalencyKey = 'car_miles' | 'household_water_days';

/** Decimal values arrive as exact strings, e.g. "246557.5". */
type DecimalString = string;

export interface EquivalencyResult {
  key: EquivalencyKey;
  /** Whole miles or household-days; null when there is no sourced factor. */
  value: number | null;
  source: string | null;
  year: number | null;
  scopeNote: string | null;
}

export interface CategoryImpact {
  rtgCategoryName: string;
  unitsReused: number;
  unitsRecycled: number;
  co2eKg: DecimalString;
  waterLitres: DecimalString;
  mineralsGrams: DecimalString;
  co2Confidence: string | null;
}

export interface PeriodImpact {
  clientId: string;
  period: { key: string; label: string; start: string; end: string };
  factorSet: { id: string; version: number; methodologyLabel: string; quarantineTreatment: QuarantineTreatment };
  result: {
    co2eKg: DecimalString;
    waterLitres: DecimalString;
    mineralsGrams: DecimalString;
    unitsReused: number;
    unitsRecycled: number;
    totalUnits: number;
    reuseRate: DecimalString;
    categories: CategoryImpact[];
    lowConfidenceCategories: string[];
  };
  display: { co2eTonnes: DecimalString; waterM3: DecimalString; mineralsKg: DecimalString; reuseRatePct: DecimalString };
  equivalencies: Record<EquivalencyKey, EquivalencyResult>;
  excluded: Array<{ assetCategoryName: string; units: number; exclusionNote: string }>;
  unmapped: Array<{ assetCategoryName: string; unitsReused: number; unitsRecycled: number }>;
  quarantine: { treatment: QuarantineTreatment; units: number };
  warnings: { missingCollectionDate: number };
}

/** One booking's figures: the same calculation as PeriodImpact, for its graded units only. */
export type BookingImpact = Omit<PeriodImpact, 'clientId' | 'period' | 'warnings'> & {
  bookingId: string;
  /** False until at least one unit has been graded. */
  graded: boolean;
  collectedAt: string | null;
  /** The quarterly client report these units count towards; null until collected. */
  period: { key: string; label: string } | null;
};

export interface MonthImpact {
  key: string;
  label: string;
  co2eKg: DecimalString;
  waterLitres: DecimalString;
  mineralsGrams: DecimalString;
  totalUnits: number;
}

/** One organisation's or one person's part of the overview. */
export interface BreakdownImpact {
  key: string;
  name: string;
  bookings: number;
  co2eKg: DecimalString;
  waterLitres: DecimalString;
  mineralsGrams: DecimalString;
  totalUnits: number;
}

/** The dashboard's environmental section: the last N months, in total and month by month. */
export type OverviewImpact = Omit<PeriodImpact, 'clientId' | 'period'> & {
  /** The client the figures are limited to, or null for everything the caller may see. */
  clientId: string | null;
  range: { months: number; start: string; end: string };
  /** Oldest first, one entry per month. */
  monthly: MonthImpact[];
  /** Most CO2e first. */
  byOrganisation: BreakdownImpact[];
  /** The employee on a JML booking, otherwise the client contact. Most CO2e first. */
  byPerson: BreakdownImpact[];
};

class EnvironmentalService {
  /** Without a client: everything the caller's role may see. */
  getOverview(clientId: string | null, months: number): Promise<OverviewImpact> {
    const query = new URLSearchParams({ months: String(months), ...(clientId ? { clientId } : {}) });
    return apiClient.get<OverviewImpact>(`/environmental/overview?${query}`);
  }
}

export const environmentalService = new EnvironmentalService();
