// The dashboard's financial section: buyback (final and estimated), the charity
// share, the cost of collection and processing, and the net to the client.
import { apiClient } from './api-client';

/** Money arrives as an exact string with pence, e.g. "19500.00". */
type Money = string;

export interface FinancialTotals {
  jobs: number;
  /** Jobs with no cost of service recorded yet, counted at £0. */
  withoutCost: number;
  buyback: Money;
  charity: Money;
  cost: Money;
  /** Buyback - charity - cost. Negative when the client owes RTG. */
  net: Money;
}

export interface RevenueShareTotals {
  jobs: number;
  /** Jobs sold for less than the client buyback. */
  losses: number;
  resale: Money;
  buyback: Money;
  /** Resale - buyback. */
  toShare: Money;
  partnerShare: Money;
  rtgShare: Money;
}

export interface FinancialOverview {
  clientId: string | null;
  range: { months: number; start: string; end: string };
  /** Buyback values an admin has confirmed, for jobs collected in the period. */
  final: FinancialTotals;
  /** Booking-time estimates not yet confirmed, including bookings still to be collected. */
  estimated: FinancialTotals;
  /** Staff and partners only (null for clients). The embed does not show it. */
  revenueShare: {
    final: RevenueShareTotals;
    estimated: RevenueShareTotals;
    /** Partner jobs with no resale value entered yet, left out of the totals. */
    awaitingResale: number;
  } | null;
  monthly: Array<{ key: string; label: string; final: Money; estimated: Money }>;
  byClient: Array<{
    clientId: string | null;
    /** The organisation name when recorded. */
    clientName: string;
    /** The contact's name, when it differs from the organisation name. */
    contactName: string | null;
    final: FinancialTotals;
    estimated: FinancialTotals;
  }>;
}

class FinancialImpactService {
  /** Without a client: everything the caller's role may see. */
  getOverview(clientId: string | null, months: number): Promise<FinancialOverview> {
    const query = new URLSearchParams({ months: String(months), ...(clientId ? { clientId } : {}) });
    return apiClient.get<FinancialOverview>(`/financial-impact?${query}`);
  }
}

export const financialImpactService = new FinancialImpactService();
