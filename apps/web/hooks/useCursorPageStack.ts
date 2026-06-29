"use client";

import { useEffect, useState } from "react";

/** Cursor stack for paginated API lists — cursors[pageIndex] is the cursor for that page. */
export function useCursorPageStack(resetKey: string) {
  const [page, setPage] = useState(1);
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);

  useEffect(() => {
    setPage(1);
    setCursors([undefined]);
  }, [resetKey]);

  const cursor = cursors[page - 1];

  function goNext(nextCursor: string | null | undefined) {
    if (!nextCursor) return;
    setCursors((prev) => {
      const next = [...prev];
      next[page] = nextCursor;
      return next;
    });
    setPage((p) => p + 1);
  }

  function goPrevious() {
    setPage((p) => Math.max(1, p - 1));
  }

  return { page, cursor, goNext, goPrevious };
}
