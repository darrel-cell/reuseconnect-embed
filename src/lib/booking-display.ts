type BookingParty = {
  isPartnerBooking?: boolean;
  resellerId?: string;
  resellerName?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  organisationName?: string;
  createdByEmail?: string;
  createdByPhone?: string;
  creatorName?: string;
  creatorRole?: string;
};

/** A stored website value as a clickable URL; profiles often omit the scheme. */
export function websiteHref(website: string): string {
  return /^https?:\/\//i.test(website) ? website : `https://${website}`;
}

export function isPartnerBooking(booking: BookingParty): boolean {
  return Boolean(booking.isPartnerBooking || booking.resellerId);
}

/**
 * Heading for a booking. On partner bookings the client's `organisationName`
 * holds the partner's own company, so the end client is `clientName`.
 */
export function bookingTitle(booking: BookingParty): string {
  return isPartnerBooking(booking)
    ? booking.clientName || booking.organisationName || ''
    : booking.organisationName || booking.clientName || '';
}

/** The client's contact details, falling back to the booker's own account when a client booked for themselves. */
export function bookingClientContact(booking: BookingParty) {
  const selfBooked = booking.creatorRole === 'client';
  return {
    name: booking.clientName || '',
    email: booking.clientEmail || (selfBooked ? booking.createdByEmail : undefined),
    phone: booking.clientPhone || (selfBooked ? booking.createdByPhone : undefined),
  };
}

/** Badge naming who raised the booking on the client's behalf; null when the client booked it themselves. */
export function bookingCreatorBadge(booking: BookingParty): string | null {
  if (booking.creatorRole === 'admin' || booking.creatorRole === 'head_of_operation') {
    return `Admin: ${booking.creatorName || 'Admin'}`;
  }
  if (booking.creatorRole === 'partner') {
    return `Partner: ${booking.resellerName || booking.creatorName || 'Partner'}`;
  }
  return null;
}
