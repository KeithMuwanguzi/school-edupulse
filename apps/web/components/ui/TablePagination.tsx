import { Button } from "@/components/ui/Button";

const PAGE_SIZE = 20;

interface TablePaginationProps {
  page: number;
  count: number;
  pageSize?: number;
  /** Total rows in the filtered roster — enables "Page X of Y". */
  totalItems?: number;
  hasNext: boolean;
  loading?: boolean;
  onPrevious: () => void;
  onNext: () => void;
}

/** Table footer with page position and optional total page count. */
export function TablePagination({
  page,
  count,
  pageSize = PAGE_SIZE,
  totalItems,
  hasNext,
  loading,
  onPrevious,
  onNext,
}: TablePaginationProps) {
  const from = count === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = (page - 1) * pageSize + count;
  const totalPages =
    totalItems != null ? Math.max(1, Math.ceil(totalItems / pageSize)) : undefined;

  let statusLine: string;
  if (count === 0) {
    statusLine = "No entries on this page";
  } else if (totalItems != null && totalPages != null) {
    statusLine = `Showing ${from}–${to} of ${totalItems} · Page ${page} of ${totalPages}`;
  } else if (hasNext) {
    statusLine = `Showing ${from}–${to} · Page ${page} · More pages follow`;
  } else if (page > 1) {
    statusLine = `Showing ${from}–${to} · Page ${page} of ${page}`;
  } else {
    statusLine = `Showing ${from}–${to}`;
  }

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[12px] text-slate-500">{statusLine}</p>
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
