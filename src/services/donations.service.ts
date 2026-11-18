// Donations to social projects, recorded by RTG staff: the dashboard's social section (read only).
import { apiClient } from './api-client';

/** Money arrives as an exact string with pence, e.g. "250.00". */
type Money = string;

export interface Donation {
  id: string;
  clientId: string;
  clientName: string;
  amount: Money;
  recipient: string;
  project: string;
  /** "2026-11-16" */
  donatedOn: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DonationSummary {
  /** The client the figures are limited to, or null for everything the caller may see. */
  clientId: string | null;
  range: { months: number; start: string; end: string };
  total: Money;
  count: number;
  byProject: Array<{ project: string; recipient: string; amount: Money; count: number }>;
  monthly: Array<{ key: string; label: string; amount: Money }>;
  /** Newest first. */
  donations: Donation[];
}

class DonationsService {
  /** Without a client: everything the caller's role may see. */
  getSummary(clientId: string | null, months: number): Promise<DonationSummary> {
    const query = new URLSearchParams({ months: String(months), ...(clientId ? { clientId } : {}) });
    return apiClient.get<DonationSummary>(`/donations?${query}`);
  }
}

export const donationsService = new DonationsService();
