import { Loader2 } from 'lucide-react';

/**
 * Shown while a lazily-loaded route chunk downloads.
 *
 * Deliberately minimal and centred so it reads as "loading this page", not as a
 * broken layout — most chunks arrive in well under a second on a warm cache.
 */
export function RouteFallback() {
  return (
    <div
      className="flex min-h-[50vh] items-center justify-center"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <span className="sr-only">Loading page…</span>
    </div>
  );
}
