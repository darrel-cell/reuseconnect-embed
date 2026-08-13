import { matchPath } from 'react-router-dom';

/**
 * Route → chrome / document title (without product suffix).
 *
 * Order matters — first matching pattern wins. More specific routes first.
 * Used by AppLayout sticky header and (via titleForPath) the browser tab.
 */
const TITLES: Array<[pattern: string, title: string]> = [
  // Public (document title only; not shown in AppLayout)
  ['/', 'ReuseConnect — Sustainable IT Asset Disposition'],
  ['/home', 'ReuseConnect — Sustainable IT Asset Disposition'],
  ['/login', 'Sign in'],
  ['/signup', 'Create an account'],
  ['/signup-client', 'Create a client account'],
  ['/signup-partner', 'Create a partner account'],
  ['/forgot-password', 'Reset your password'],
  ['/reset-password', 'Choose a new password'],
  ['/invite', 'Accept your invitation'],

  // Bookings — specific before general
  ['/bookings/jml/new-starter', 'New Starter — JML'],
  ['/bookings/jml/leaver', 'Leaver — JML'],
  ['/bookings/jml/breakfix', 'Breakfix — JML'],
  ['/bookings/jml/mover', 'Mover — JML'],
  ['/bookings/jml', 'JML Bookings'],
  ['/bookings/:id/certificates', 'Sanitisation Certificates'],
  ['/bookings/:id/grading', 'Asset Grading Report'],
  ['/bookings/:id/summary', 'Booking Completion Summary'],
  ['/bookings/:id/timeline', 'Booking Timeline'],
  ['/bookings/:id', 'Booking'],
  ['/bookings', 'Booking History'],
  ['/booking/itad', 'New ITAD Booking'],
  ['/booking/courier', 'New Courier Booking'],
  ['/booking', 'New Booking'],
  ['/booking-review/:id', 'Booking Approval'],

  // Jobs
  ['/jobs/history', 'Job History'],
  ['/jobs/:id', 'Job Details'],
  ['/jobs', 'Jobs & Collections'],

  // Driver and warehouse
  ['/driver/schedule', 'Route & Schedule'],
  ['/driver/jobs/:id', 'Collection'],
  ['/warehouse/jobs/:id', 'Warehouse Processing'],
  ['/warehouse/sanitisation/:id', 'Sanitisation Management'],
  ['/warehouse/grading/:id', 'Asset Grading'],

  // Admin
  ['/admin/bookings', 'Booking Queue'],
  ['/admin/booking-approval/:id', 'Booking Approval'],
  ['/admin/booking-inventory/:id', 'Inventory Processing'],
  ['/admin/approval/:id', 'Final Approval'],
  ['/admin/assign', 'Assign Drivers'],
  ['/admin/device-allocation', 'Allocate Devices'],
  ['/admin/drivers', 'Driver Management'],
  ['/admin/vehicles', 'Vehicles'],
  ['/admin/jml-bookings', 'JML Bookings'],
  ['/admin/grading/:id', 'Asset Grading'],
  ['/admin/sanitisation/:id', 'Sanitisation Management'],
  ['/referral-partners', 'Referral Partners'],
  ['/audit-logs', 'Audit Logs'],

  // Everything else
  ['/dashboard', 'Dashboard'],
  ['/co2e', 'CO₂e Dashboard'],
  ['/clients', 'Client Management'],
  ['/sites', 'Site Management'],
  ['/users', 'User Management'],
  ['/departments', 'Departments'],
  ['/inventory', 'Inventory Management'],
  ['/documents', 'Compliance Documents'],
  ['/notifications', 'Notifications'],
  ['/profile', 'Profile'],
  ['/settings', 'Settings'],
];

const CO2_VIEW_TITLES: Record<string, string> = {
  organisation: 'CO₂e by Organisation',
  user: 'CO₂e by User',
  serial: 'CO₂e by Serial Number',
};

const SUFFIX = 'ReuseConnect';

/**
 * Sticky AppLayout header title for a pathname (+ optional search for CO₂e views).
 */
export function chromeTitleForPath(pathname: string, search = ''): string {
  if (pathname === '/co2e') {
    const view = new URLSearchParams(search).get('view');
    if (view && CO2_VIEW_TITLES[view]) return CO2_VIEW_TITLES[view];
  }

  for (const [pattern, title] of TITLES) {
    if (matchPath({ path: pattern, end: true }, pathname)) {
      return title;
    }
  }
  return SUFFIX;
}

/**
 * Browser document title (chrome title + product suffix, except marketing home).
 */
export function titleForPath(pathname: string, search = ''): string {
  const title = chromeTitleForPath(pathname, search);
  if (pathname === '/' || pathname === '/home') return title;
  if (title === SUFFIX) return SUFFIX;
  return `${title} · ${SUFFIX}`;
}
