import type { ReactNode } from "react";
import Table from "react-bootstrap/Table";
import EmptyState from "@/components/common/EmptyState";
import ErrorAlert from "@/components/common/ErrorAlert";
import LoadingState from "@/components/common/LoadingState";

// A table for API lists (S2): column-driven, server-side sorting only, and explicit loading, error, and
// empty states. No client sorting, row selection, or column hiding.

export interface Column<Row> {
  key: string;
  header: string;
  cell: (row: Row) => ReactNode;
  /** API sort field; makes the header a sort button. */
  sortField?: string;
  className?: string;
}

interface DataTableProps<Row> {
  /** Accessible table name (visually hidden; the page heading is visible). */
  caption: string;
  columns: Column<Row>[];
  rows: Row[] | undefined;
  rowKey: (row: Row) => string | number;
  /** Current API sort, e.g. "last_name" or "-hired_on". */
  sort?: string;
  onSortChange?: (sort: string) => void;
  isLoading?: boolean;
  /** Refreshing while showing previous rows (marks the table busy). */
  isFetching?: boolean;
  error?: unknown;
  onRetry?: () => void;
  emptyMessage: string;
  emptyAction?: ReactNode;
}

function sortState(
  field: string,
  sort: string | undefined,
): "ascending" | "descending" | undefined {
  if (sort === field) return "ascending";
  if (sort === `-${field}`) return "descending";
  return undefined;
}

export default function DataTable<Row>({
  caption,
  columns,
  rows,
  rowKey,
  sort,
  onSortChange,
  isLoading = false,
  isFetching = false,
  error,
  onRetry,
  emptyMessage,
  emptyAction,
}: DataTableProps<Row>) {
  if (error) return <ErrorAlert error={error} onRetry={onRetry} />;
  if (isLoading || !rows) return <LoadingState label="Loading…" />;
  if (rows.length === 0)
    return <EmptyState message={emptyMessage} action={emptyAction} />;

  return (
    <Table
      responsive
      hover
      className="align-middle"
      aria-busy={isFetching || undefined}
    >
      <caption className="visually-hidden">{caption}</caption>
      <thead>
        <tr>
          {columns.map((column) => {
            const state = column.sortField
              ? sortState(column.sortField, sort)
              : undefined;
            return (
              <th
                key={column.key}
                scope="col"
                className={column.className}
                aria-sort={state}
              >
                {column.sortField && onSortChange ? (
                  <button
                    type="button"
                    className="btn btn-link p-0 fw-semibold text-body text-decoration-none"
                    onClick={() => {
                      const field = column.sortField as string;
                      onSortChange(state === "ascending" ? `-${field}` : field);
                    }}
                  >
                    {column.header}
                    <span aria-hidden="true" className="ms-1">
                      {state === "ascending"
                        ? "▲"
                        : state === "descending"
                          ? "▼"
                          : "↕"}
                    </span>
                  </button>
                ) : (
                  column.header
                )}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={rowKey(row)}>
            {columns.map((column) => (
              <td key={column.key} className={column.className}>
                {column.cell(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
