import ToggleButton from "react-bootstrap/ToggleButton";
import ToggleButtonGroup from "react-bootstrap/ToggleButtonGroup";
import DataTable, { type Column } from "@/components/common/DataTable";
import MoneyAmount from "@/components/common/MoneyAmount";
import { formatCount } from "@/components/common/format";
import { useAnalyticsBreakdown } from "@/components/dashboard/useAnalytics";
import type {
  BreakdownDimension,
  BreakdownRow,
} from "@/services/analytics.types";
import type { QueryParams } from "@/services/api";

// Breakdown by country or department (FRONTEND_PLAN.md V9; API §8.4). One row per dimension and currency,
// in API order. Not sortable: ordering rows by amount would compare different currencies.

const DIMENSION_LABELS: Record<BreakdownDimension, string> = {
  country: "Country",
  department: "Department",
};

function breakdownColumns(by: BreakdownDimension): Column<BreakdownRow>[] {
  const money =
    (metric: "total" | "average" | "median") => (row: BreakdownRow) => (
      <MoneyAmount amount={row[metric]} currencyCode={row.currency_code} />
    );
  return [
    {
      key: "dimension",
      header: DIMENSION_LABELS[by],
      cell: (row) =>
        row.dimension.code
          ? `${row.dimension.name} (${row.dimension.code})`
          : row.dimension.name,
    },
    { key: "currency", header: "Currency", cell: (row) => row.currency_code },
    {
      key: "employees",
      header: "Employees",
      cell: (row) => formatCount(row.employee_count),
    },
    { key: "total", header: "Monthly total", cell: money("total") },
    { key: "average", header: "Monthly average", cell: money("average") },
    { key: "median", header: "Monthly median", cell: money("median") },
  ];
}

export default function BreakdownTable({
  filters,
  by,
  onByChange,
}: {
  filters: QueryParams;
  by: BreakdownDimension;
  onByChange: (by: BreakdownDimension) => void;
}) {
  const breakdown = useAnalyticsBreakdown(filters, by);
  // Previous rows stay on screen while new filters load, but never under the other dimension's header.
  const rows = breakdown.data?.by === by ? breakdown.data.rows : undefined;

  return (
    <>
      <ToggleButtonGroup
        type="radio"
        name="breakdown-by"
        value={by}
        onChange={onByChange}
        className="mb-3"
        aria-label="Break down by"
      >
        {(Object.keys(DIMENSION_LABELS) as BreakdownDimension[]).map(
          (dimension) => (
            <ToggleButton
              key={dimension}
              id={`breakdown-by-${dimension}`}
              value={dimension}
              variant="outline-primary"
              size="sm"
            >
              By {DIMENSION_LABELS[dimension].toLowerCase()}
            </ToggleButton>
          ),
        )}
      </ToggleButtonGroup>
      <DataTable<BreakdownRow>
        caption={`Breakdown by ${by}`}
        columns={breakdownColumns(by)}
        rows={rows}
        rowKey={(row) => `${row.dimension.id}-${row.currency_code}`}
        isLoading={breakdown.isPending}
        isFetching={breakdown.isFetching && !breakdown.isPending}
        error={breakdown.isError ? breakdown.error : undefined}
        onRetry={() => void breakdown.refetch()}
        emptyMessage="No salaries in effect for these filters."
      />
    </>
  );
}
