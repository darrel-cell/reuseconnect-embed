// Display helpers for RTG environmental impact.
import { UK_LOCALE, UK_TIME_ZONE } from './datetime';

/** As the PDF report formats figures: grouped, up to 2 decimal places, no trailing zeros. */
export function formatFigure(value: string | number | null | undefined, maxDecimals = 2): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n.toLocaleString(UK_LOCALE, { maximumFractionDigits: maxDecimals }) : '—';
}

export interface QuarterOption {
  /** "2026-Q3", as the API expects. */
  key: string;
  /** "Q3 2026", as printed on reports. */
  label: string;
  /** The quarter in progress, so its figures are still growing. */
  inProgress: boolean;
}

/** The current quarter in UK time. */
function currentUkQuarter(now = new Date()): { year: number; quarter: number } {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: UK_TIME_ZONE, year: 'numeric', month: 'numeric' }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  return { year, quarter: Math.floor((month - 1) / 3) + 1 };
}

/** The current quarter and the `count - 1` before it, newest first. */
export function recentQuarters(count = 8, now = new Date()): QuarterOption[] {
  let { year, quarter } = currentUkQuarter(now);
  const options: QuarterOption[] = [];
  for (let i = 0; i < count; i++) {
    options.push({ key: `${year}-Q${quarter}`, label: `Q${quarter} ${year}`, inProgress: i === 0 });
    quarter -= 1;
    if (quarter === 0) {
      quarter = 4;
      year -= 1;
    }
  }
  return options;
}

export const QUARANTINE_LABELS: Record<'reuse' | 'recycle' | 'exclude', string> = {
  reuse: 'Credited as reused',
  recycle: 'Credited at the recycling figure',
  exclude: 'Left out until the outcome is known',
};

/** Confidence values the workbook marks as weaker evidence ("Low", "Low-Med"). */
export const isLowConfidence = (confidence: string | null | undefined) => !!confidence && /^low/i.test(confidence.trim());
