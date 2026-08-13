import { useEffect, useMemo, useState } from "react";
import type { PaginationMeta } from "@/services/api-client";

/**
 * Client-side page slice for lists that already load the full (or filtered) set.
 * Pass `resetKey` (e.g. search+filter) so the page resets when filters change.
 */
export function useClientPagination<T>(items: T[], resetKey: string | number = "") {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  const pagination = useMemo<PaginationMeta>(() => {
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / limit) || 1);
    const safePage = Math.min(page, totalPages);
    return { page: safePage, limit, total, totalPages };
  }, [items.length, limit, page]);

  const pagedItems = useMemo(() => {
    const start = (pagination.page - 1) * pagination.limit;
    return items.slice(start, start + pagination.limit);
  }, [items, pagination.page, pagination.limit]);

  return {
    setPage,
    setLimit: (next: number) => {
      setLimit(next);
      setPage(1);
    },
    pagination,
    pagedItems,
  };
}
