export const REFERRAL_DISPLAY_NAME_MAX_LENGTH = 128;

export const RESERVED_REFERRAL_SLUGS = new Set([
  'admin',
  'api',
  'auth',
  'client',
  'clients',
  'dashboard',
  'home',
  'invite',
  'login',
  'partner',
  'signup',
  'signup-client',
  'signup-partner',
  'users',
  'settings',
  'bookings',
  'jobs',
  'documents',
  'preview',
]);

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validateReferralSlug(slug: string): string | null {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) {
    return 'Slug is required.';
  }
  if (normalized.length < 2 || normalized.length > 64) {
    return 'Slug must be between 2 and 64 characters.';
  }
  if (!SLUG_REGEX.test(normalized)) {
    return 'Slug must use lowercase letters, numbers, and hyphens only.';
  }
  if (RESERVED_REFERRAL_SLUGS.has(normalized)) {
    return 'This slug is reserved and cannot be used.';
  }
  return null;
}

export function validateReferralDisplayName(displayName: string): string | null {
  const trimmed = displayName.trim();
  if (!trimmed) {
    return 'Display name is required.';
  }
  if (trimmed.length < 2) {
    return 'Display name must be at least 2 characters.';
  }
  if (trimmed.length > REFERRAL_DISPLAY_NAME_MAX_LENGTH) {
    return `Display name must be at most ${REFERRAL_DISPLAY_NAME_MAX_LENGTH} characters.`;
  }
  return null;
}
