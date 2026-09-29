import { useState } from "react";
import Button from "react-bootstrap/Button";
import Col from "react-bootstrap/Col";
import Row from "react-bootstrap/Row";
import { Link } from "react-router";
import DataTable, { type Column } from "@/components/common/DataTable";
import EmploymentStatusBadge from "@/components/common/EmploymentStatusBadge";
import FormField from "@/components/common/FormField";
import MoneyAmount from "@/components/common/MoneyAmount";
import Pagination from "@/components/common/Pagination";
import {
  CountrySelect,
  DepartmentSelect,
  EmploymentStatusSelect,
} from "@/components/common/ReferenceSelects";
import SearchInput from "@/components/common/SearchInput";
import { formatCount } from "@/components/common/format";
import ExportCsvButton from "@/components/reports/ExportCsvButton";
import { useSalaryReport } from "@/components/reports/useSalaryReport";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useListParams } from "@/hooks/useListParams";
import {
  REPORT_SORT_FIELDS,
  type SalaryReportRow,
} from "@/services/report.types";

// Salary report (FRONTEND_PLAN.md V1, V3–V5, V10, V11; API §9): the salary in effect on a date for each
// employee in scope, with the analytics filters plus search, sort, pagination, and CSV export.

const columns: Column<SalaryReportRow>[] = [
  {
    key: "number",
    header: "Employee number",
    sortField: "employee_number",
    cell: (row) => (
      <Link to={`/employees/${row.employee_id}`}>{row.employee_number}</Link>
    ),
  },
  {
    key: "name",
    header: "Name",
    sortField: "last_name",
    cell: (row) => `${row.last_name}, ${row.first_name}`,
  },
  { key: "country", header: "Country", cell: (row) => row.country.name },
  {
    key: "department",
    header: "Department",
    cell: (row) => row.department.name,
  },
  {
    key: "status",
    header: "Status",
    cell: (row) => <EmploymentStatusBadge status={row.employment_status} />,
  },
  {
    key: "amount",
    header: "Monthly amount",
    sortField: "amount",
    cell: (row) => (
      <MoneyAmount amount={row.amount} currencyCode={row.currency_code} />
    ),
  },
  {
    key: "from",
    header: "Effective from",
    cell: (row) => row.effective_from,
  },
];

export default function SalaryReportPage() {
  useDocumentTitle("Salary report");
  const list = useListParams({
    sortFields: REPORT_SORT_FIELDS,
    defaultSort: "employee_number",
    filters: ["as_of", "country_id", "department_id", "employment_status"],
  });
  const report = useSalaryReport(list.query);
  // Remounting the search box clears its text when filters are cleared.
  const [searchKey, setSearchKey] = useState(0);

  const { filters } = list;
  const hasFilters = Object.keys(filters).length > 0 || list.q !== "";
  const meta = report.data?.meta;
  const sortedByAmount = list.sort.replace(/^-/, "") === "amount";

  function clearFilters() {
    list.clearFilters();
    setSearchKey((key) => key + 1);
  }

  return (
    <>
      <div className="d-flex flex-wrap align-items-start justify-content-between gap-2 mb-3">
        <div>
          <h1 className="h3 mb-1">Salary report</h1>
          <p className="text-body-secondary mb-0">
            {meta
              ? `Monthly salaries in effect on ${meta.as_of}.`
              : "Monthly salaries in effect on a date."}
          </p>
        </div>
        <ExportCsvButton query={list.query} />
      </div>

      <Row className="g-3 mb-2">
        <Col md={12} lg={5}>
          <SearchInput
            key={searchKey}
            label="Search"
            placeholder="Name or employee number"
            onSearch={list.setQ}
          />
        </Col>
        <Col sm={6} lg={3}>
          <FormField
            label="As of"
            type="date"
            value={filters.as_of ?? ""}
            onChange={(event) =>
              list.setFilter("as_of", event.target.value || null)
            }
            hint="Empty means today."
          />
        </Col>
        <Col sm={6} lg={4}>
          <CountrySelect
            value={filters.country_id ?? ""}
            onChange={(value) => list.setFilter("country_id", value || null)}
          />
        </Col>
        <Col sm={6} lg={4}>
          <DepartmentSelect
            value={filters.department_id ?? ""}
            onChange={(value) => list.setFilter("department_id", value || null)}
          />
        </Col>
        <Col sm={6} lg={4}>
          <EmploymentStatusSelect
            label="Status"
            allLabel="Active and on leave (default)"
            value={filters.employment_status ?? ""}
            onChange={(value) =>
              list.setFilter("employment_status", value || null)
            }
          />
        </Col>
        <Col lg={4} className="align-self-end">
          <Button
            variant="outline-secondary"
            className="w-100"
            onClick={clearFilters}
            disabled={!hasFilters}
          >
            Clear filters
          </Button>
        </Col>
      </Row>
      <p className="text-body-secondary small mb-3">
        Country, department, and status are each employee&apos;s current values,
        also for a past date.
      </p>

      {meta && (
        <p className="mb-2" role="status">
          {formatCount(meta.total_count)}{" "}
          {meta.total_count === 1 ? "employee" : "employees"}
          {sortedByAmount &&
            ". Sorted by amount within each currency (currencies A–Z)"}
          .
        </p>
      )}

      <DataTable<SalaryReportRow>
        caption="Salary report"
        columns={columns}
        rows={report.data?.data}
        rowKey={(row) => row.employee_id}
        sort={list.sort}
        onSortChange={list.setSort}
        isLoading={report.isPending}
        isFetching={report.isFetching && !report.isPending}
        error={report.isError ? report.error : undefined}
        onRetry={() => void report.refetch()}
        emptyMessage={
          hasFilters
            ? "No salaries match these filters."
            : "No salaries in effect on this date."
        }
        emptyAction={
          hasFilters ? (
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={clearFilters}
            >
              Clear filters
            </Button>
          ) : undefined
        }
      />

      {meta && meta.total_count > 0 && (
        <Pagination
          meta={meta}
          onPageChange={list.setPage}
          onPerPageChange={list.setPerPage}
        />
      )}
    </>
  );
}
