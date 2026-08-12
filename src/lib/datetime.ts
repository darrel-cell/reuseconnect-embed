/**
 * Date and time rendering, fixed to UK time.
 *
 * This is a UK operation: collection dates, driver ETAs, warehouse timestamps and
 * certificate dates are all UK working times, and everyone reading them — client,
 * partner, driver, technician, admin — is talking about the same UK clock.
 *
 * Every one of these used to be a bare `toLocaleDateString()` / `toLocaleTimeString()`,
 * which renders in *the viewer's* timezone. Two consequences, both real:
 *
 *  - A `scheduledDate` stored as UTC midnight renders as the **previous day** for any
 *    viewer behind UTC. A collection booked for the 1st reads as the 31st.
 *  - During British Summer Time the UK is UTC+1, so a 09:00 BST collection renders as
 *    08:00 for a viewer sitting in UTC — including a server-rendered or UTC-configured
 *    machine. An hour out, on a driver's arrival time.
 *
 * `Europe/London` rather than a fixed offset, so GMT/BST is handled by the platform
 * instead of being something anyone has to remember twice a year.
 */

/** The one timezone this product displays. */
export const UK_TIME_ZONE = 'Europe/London';

/** UK conventions: day/month/year, 24-hour clock. */
export const UK_LOCALE = 'en-GB';

type DateInput = Date | string | number | null | undefined;

/**
 * Coerce to a Date, or null if it cannot be one.
 *
 * Returning null rather than an Invalid Date matters: `new Date(undefined).toLocaleDateString()`
 * yields the string "Invalid Date", which then renders to the user as those exact words.
 */
function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const withZone = (options: Intl.DateTimeFormatOptions): Intl.DateTimeFormatOptions => ({
  ...options,
  timeZone: UK_TIME_ZONE,
});

/** `01/09/2026` — the default for any date shown on its own. */
export function formatDate(value: DateInput, fallback = '—'): string {
  const date = toDate(value);
  if (!date) return fallback;
  return date.toLocaleDateString(UK_LOCALE, withZone({ day: '2-digit', month: '2-digit', year: 'numeric' }));
}

/** `1 September 2026` — for certificates and anywhere the month should be unambiguous. */
export function formatDateLong(value: DateInput, fallback = '—'): string {
  const date = toDate(value);
  if (!date) return fallback;
  return date.toLocaleDateString(UK_LOCALE, withZone({ day: 'numeric', month: 'long', year: 'numeric' }));
}

/** `1 Sep 2026` — for tables and cards where space is tight. */
export function formatDateShort(value: DateInput, fallback = '—'): string {
  const date = toDate(value);
  if (!date) return fallback;
  return date.toLocaleDateString(UK_LOCALE, withZone({ day: 'numeric', month: 'short', year: 'numeric' }));
}

/** `09:30` — 24-hour, as an ETA or a shift time should read. */
export function formatTime(value: DateInput, fallback = '—'): string {
  const date = toDate(value);
  if (!date) return fallback;
  return date.toLocaleTimeString(UK_LOCALE, withZone({ hour: '2-digit', minute: '2-digit', hour12: false }));
}

/** `01/09/2026, 09:30` — for audit trails and status history, where the time matters. */
export function formatDateTime(value: DateInput, fallback = '—'): string {
  const date = toDate(value);
  if (!date) return fallback;
  return date.toLocaleString(
    UK_LOCALE,
    withZone({
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  );
}

/**
 * Format with your own options, still in UK time.
 *
 * For the handful of places that want something bespoke — a weekday, a month on its
 * own — without giving up the timezone.
 */
export function formatInUkZone(
  value: DateInput,
  options: Intl.DateTimeFormatOptions,
  fallback = '—'
): string {
  const date = toDate(value);
  if (!date) return fallback;
  return date.toLocaleString(UK_LOCALE, withZone(options));
}

/**
 * Today's date in UK terms, as `YYYY-MM-DD`.
 *
 * For `<input type="date">` min/max and for comparing "is this in the past", both of
 * which have to use the UK day boundary rather than the viewer's.
 */
export function ukToday(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: UK_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return parts; // en-CA gives ISO-ordered YYYY-MM-DD
}
