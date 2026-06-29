"use client";

import { useEffect, useMemo, useState } from "react";

import { ROSTER_PAGE_SIZE } from "@/lib/rosterConstants";

export function useClientPageSlice<T>(
  items: T[],
  resetKey: string,
  pageSize: number = ROSTER_PAGE_SIZE,
) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  return {
    page: safePage,
    pageItems,
    pageSize,
    total: items.length,
    hasNext: safePage < totalPages,
    hasPrevious: safePage > 1,
    goNext: () => setPage((p) => Math.min(totalPages, p + 1)),
    goPrevious: () => setPage((p) => Math.max(1, p - 1)),
  };
}
