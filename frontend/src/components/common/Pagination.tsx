import { useId } from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import { formatCount } from "@/components/common/format";
import { PER_PAGE_OPTIONS } from "@/hooks/useListParams";
import type { PaginationMeta } from "@/services/api";

interface PaginationProps {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
}

/** Page navigation for API lists (S3): First/Previous/Next/Last, range text, and page size. */
export default function Pagination({
  meta,
  onPageChange,
  onPerPageChange,
}: PaginationProps) {
  const perPageId = useId();
  const {
    page,
    per_page: perPage,
    total_count: total,
    total_pages: totalPages,
  } = meta;
  const pastEnd = total > 0 && page > totalPages;
  const first = (page - 1) * perPage + 1;
  const last = Math.min(page * perPage, total);

  let summary: string;
  if (total === 0) summary = "No results";
  else if (pastEnd) summary = "No results on this page";
  else
    summary = `Showing ${formatCount(first)}–${formatCount(last)} of ${formatCount(total)}`;

  return (
    <nav
      aria-label="Pagination"
      className="d-flex flex-wrap align-items-center justify-content-between gap-3 mt-3"
    >
      <p className="mb-0 small" aria-live="polite">
        {summary}
      </p>

      {pastEnd ? (
        <Button
          variant="outline-primary"
          size="sm"
          onClick={() => onPageChange(1)}
        >
          Go to first page
        </Button>
      ) : (
        totalPages > 1 && (
          <div className="d-flex align-items-center gap-1">
            <Button
              variant="outline-secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(1)}
            >
              First
            </Button>
            <Button
              variant="outline-secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              Previous
            </Button>
            <span className="small px-2">
              Page {formatCount(page)} of {formatCount(totalPages)}
            </span>
            <Button
              variant="outline-secondary"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              Next
            </Button>
            <Button
              variant="outline-secondary"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange(totalPages)}
            >
              Last
            </Button>
          </div>
        )
      )}

      <div className="d-flex align-items-center gap-2">
        <Form.Label htmlFor={perPageId} className="mb-0 small">
          Rows per page
        </Form.Label>
        <Form.Select
          id={perPageId}
          size="sm"
          style={{ width: "auto" }}
          value={perPage}
          onChange={(event) => onPerPageChange(Number(event.target.value))}
        >
          {PER_PAGE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Form.Select>
      </div>
    </nav>
  );
}
