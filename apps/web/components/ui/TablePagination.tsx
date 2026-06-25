import { Button } from "@/components/ui/Button";

const PAGE_SIZE = 20;

interface TablePaginationProps {
  page: number;
  count: number;
  pageSize?: number;
  hasNext: boolean;
  loading?: boolean;
  onPrevious: () => void;
  onNext: () => void;
}

/** Cursor-style table footer — shows 20 rows per page by default. */
export function TablePagination({
  page,
  count,
  pageSize = PAGE_SIZE,
  hasNext,
  loading,
  onPrevious,
  onNext,
}: TablePaginationProps) {
  const from = count === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = (page - 1) * pageSize + count;

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[12px] text-slate-500">
        {count === 0
          ? "No entries on this page"
          : `Showing ${from}–${to} · Page ${page}`}
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={page <= 1 || loading}
          onClick={onPrevious}
        >
          Previous
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!hasNext || loading}
          onClick={onNext}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export { PAGE_SIZE };
