import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { PaginationMeta } from '@/services/api-client';

interface Props {
  pagination?: PaginationMeta;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  /** Plural noun for the count line, e.g. "bookings". */
  itemLabel?: string;
  isLoading?: boolean;
}

/** Server caps at 100, so do not offer more. */
const PAGE_SIZES = [20, 50, 100];

/**
 * Pagination footer for list pages.
 *
 * The shadcn `pagination` primitive existed in the repo but was imported by
 * nothing, and no list passed page/limit — so every list silently showed the
 * server's default 20 rows with no indication that more existed. This makes the
 * total visible and the rest reachable.
 */
export function ListPagination({
  pagination,
  onPageChange,
  onLimitChange,
  itemLabel = 'items',
  isLoading,
}: Props) {
  if (!pagination) return null;

  const { page, limit, total, totalPages } = pagination;

  // A single page that fits entirely needs no controls, but the count is still
  // worth showing so "20 of 20" never looks like a truncation.
  const showControls = totalPages > 1;

  const first = total === 0 ? 0 : (page - 1) * limit + 1;
  const last = Math.min(page * limit, total);

  return (
    <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {total === 0 ? (
          <>No {itemLabel}</>
        ) : (
          <>
            Showing <span className="font-medium text-foreground">{first}–{last}</span> of{' '}
            <span className="font-medium text-foreground">{total}</span> {itemLabel}
          </>
        )}
      </p>

      <div className="flex items-center gap-3">
        {onLimitChange && total > PAGE_SIZES[0] && (
          <div className="flex items-center gap-2">
            <label htmlFor="page-size" className="whitespace-nowrap text-sm text-muted-foreground">
              Per page
            </label>
            <Select
              value={String(limit)}
              onValueChange={(v) => onLimitChange(Number(v))}
            >
              <SelectTrigger id="page-size" className="h-9 w-[75px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {showControls && (
          <nav className="flex items-center gap-1" aria-label={`${itemLabel} pagination`}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1 || isLoading}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="ml-1 hidden sm:inline">Previous</span>
            </Button>
            <span className="px-2 text-sm text-muted-foreground whitespace-nowrap">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages || isLoading}
              aria-label="Next page"
            >
              <span className="mr-1 hidden sm:inline">Next</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </nav>
        )}
      </div>
    </div>
  );
}
