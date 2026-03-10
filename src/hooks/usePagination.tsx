import { useState, useCallback } from "react";

const PAGE_SIZE = 50;

export function usePagination(pageSize = PAGE_SIZE) {
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const nextPage = useCallback(() => setPage(p => Math.min(p + 1, totalPages - 1)), [totalPages]);
  const prevPage = useCallback(() => setPage(p => Math.max(p - 1, 0)), []);
  const resetPage = useCallback(() => setPage(0), []);

  return {
    page, setPage, totalCount, setTotalCount,
    totalPages, from, to, pageSize,
    nextPage, prevPage, resetPage,
    hasNext: page < totalPages - 1,
    hasPrev: page > 0,
  };
}
