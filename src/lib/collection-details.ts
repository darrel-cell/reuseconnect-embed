/** Collection / chain-of-custody fields shared across booking create, detail, and approval. */
export const COLLECTION_DETAIL_FIELDS = [
  {
    key: 'dial2Collection',
    label: 'DIAL 2 Collection',
    placeholder: 'e.g., 1 Person, 2 or more persons',
  },
  {
    key: 'securityRequirements',
    label: 'Security Requirements',
    placeholder: 'e.g., Security badge required at reception',
  },
  {
    key: 'idRequired',
    label: 'ID Required',
    placeholder: 'e.g., Yes - Photo ID required',
  },
  {
    key: 'loadingBayLocation',
    label: 'Loading Bay Location',
    placeholder: 'e.g., Loading bay 3, rear entrance',
  },
  {
    key: 'vehicleHeightRestrictions',
    label: 'Vehicle Height Restrictions',
    placeholder: 'e.g., Maximum height 3.5m / N/A',
  },
  {
    key: 'doorLiftSize',
    label: 'Door & Lift Size',
    placeholder: 'e.g., Standard loading bay doors, lift available',
  },
  {
    key: 'roadWorksPublicEvents',
    label: 'Road Works / Public Events',
    placeholder: 'e.g., None reported / N/A',
  },
  {
    key: 'manualHandlingRequirements',
    label: 'Manual Handling Requirements',
    placeholder: 'e.g., Heavy items require two-person lift',
  },
] as const;

export type CollectionDetailKey = (typeof COLLECTION_DETAIL_FIELDS)[number]['key'];

export type CollectionDetails = Record<CollectionDetailKey, string>;

export function emptyCollectionDetails(): CollectionDetails {
  return {
    dial2Collection: '',
    securityRequirements: '',
    idRequired: '',
    loadingBayLocation: '',
    vehicleHeightRestrictions: '',
    doorLiftSize: '',
    roadWorksPublicEvents: '',
    manualHandlingRequirements: '',
  };
}

export function collectionDetailsFromBooking(booking: {
  dial2Collection?: string | null;
  securityRequirements?: string | null;
  idRequired?: string | null;
  loadingBayLocation?: string | null;
  vehicleHeightRestrictions?: string | null;
  doorLiftSize?: string | null;
  roadWorksPublicEvents?: string | null;
  manualHandlingRequirements?: string | null;
}): CollectionDetails {
  return {
    dial2Collection: booking.dial2Collection || '',
    securityRequirements: booking.securityRequirements || '',
    idRequired: booking.idRequired || '',
    loadingBayLocation: booking.loadingBayLocation || '',
    vehicleHeightRestrictions: booking.vehicleHeightRestrictions || '',
    doorLiftSize: booking.doorLiftSize || '',
    roadWorksPublicEvents: booking.roadWorksPublicEvents || '',
    manualHandlingRequirements: booking.manualHandlingRequirements || '',
  };
}

export function hasAnyCollectionDetail(details: CollectionDetails): boolean {
  return COLLECTION_DETAIL_FIELDS.some((f) => details[f.key].trim() !== '');
}

const AUDIT_ROLE_LABELS: Record<string, string> = {
  client: 'Client',
  partner: 'Partner',
  admin: 'Admin',
  head_of_operation: 'Head of Operations',
  driver: 'Driver',
};

/** e.g. "Last updated by Driver John Smith · 30 Sep 2026, 10:15" */
export function formatCollectionDetailsAudit(source: {
  collectionDetailsUpdatedAt?: string | null;
  collectionDetailsUpdatedByName?: string | null;
  collectionDetailsUpdatedByRole?: string | null;
}): string | null {
  if (!source.collectionDetailsUpdatedAt) return null;
  const role = source.collectionDetailsUpdatedByRole
    ? AUDIT_ROLE_LABELS[source.collectionDetailsUpdatedByRole] ?? source.collectionDetailsUpdatedByRole
    : '';
  const who = [role, source.collectionDetailsUpdatedByName].filter(Boolean).join(' ');
  const when = new Date(source.collectionDetailsUpdatedAt).toLocaleString('en-GB', {
    timeZone: 'Europe/London',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return who ? `Last updated by ${who} · ${when}` : `Last updated ${when}`;
}
