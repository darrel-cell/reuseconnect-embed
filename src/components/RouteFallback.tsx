import { Loader2 } from 'lucide-react';

/**
 * Shown while a lazily-loaded route chunk downloads.
 *
 * Used inside AppLayout around `<Outlet />` so only the main pane is replaced —
 * the sidebar stays mounted. Also used at the app root for routes outside the
 * layout. Deliberately minimal; most chunks arrive quickly on a warm cache.
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
