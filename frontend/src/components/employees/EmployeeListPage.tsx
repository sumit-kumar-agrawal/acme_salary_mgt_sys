import { useState } from "react";
import Button from "react-bootstrap/Button";
import Col from "react-bootstrap/Col";
import Row from "react-bootstrap/Row";
import { Link, useLocation } from "react-router";
import DataTable, { type Column } from "@/components/common/DataTable";
import EmploymentStatusBadge from "@/components/common/EmploymentStatusBadge";
import Pagination from "@/components/common/Pagination";
import {
  CountrySelect,
  DepartmentSelect,
  EmploymentStatusSelect,
} from "@/components/common/ReferenceSelects";
import SearchInput from "@/components/common/SearchInput";
import { useEmployeeList } from "@/components/employees/useEmployees";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useListParams } from "@/hooks/useListParams";
import {
  EMPLOYEE_SORT_FIELDS,
  type EmployeeSummary,
} from "@/services/employee.types";

// Employee list (FRONTEND_PLAN.md T4): search, filters, sort, and pagination. No email or salary (D18).

export default function EmployeeListPage() {
  useDocumentTitle("Employees");
  const location = useLocation();
  const list = useListParams({
    sortFields: EMPLOYEE_SORT_FIELDS,
    defaultSort: "employee_number",
    filters: ["country_id", "department_id", "employment_status"],
  });
  const employees = useEmployeeList(list.query);
  // Remounting the search box clears its text when filters are cleared.
  const [searchKey, setSearchKey] = useState(0);

  const hasFilters = Object.keys(list.filters).length > 0 || list.q !== "";
  const backTo = `${location.pathname}${location.search}`;

  function clearFilters() {
    list.clearFilters();
    setSearchKey((key) => key + 1);
  }

  const columns: Column<EmployeeSummary>[] = [
    {
      key: "number",
      header: "Employee number",
      sortField: "employee_number",
      cell: (employee) => (
        <Link to={`/employees/${employee.id}`} state={{ from: backTo }}>
          {employee.employee_number}
        </Link>
      ),
    },
    {
      key: "name",
      header: "Name",
      sortField: "last_name",
      cell: (employee) => `${employee.last_name}, ${employee.first_name}`,
    },
    {
      key: "country",
      header: "Country",
      cell: (employee) => employee.country.name,
    },
    {
      key: "department",
      header: "Department",
      cell: (employee) => employee.department.name,
    },
    {
      key: "status",
      header: "Status",
      cell: (employee) => (
        <EmploymentStatusBadge status={employee.employment_status} />
      ),
    },
    {
      key: "hired",
      header: "Hired on",
      sortField: "hired_on",
      cell: (employee) => employee.hired_on ?? "—",
    },
  ];

  return (
    <>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h1 className="h3 mb-0">Employees</h1>
        <div className="d-flex gap-2">
          {/* Salaries are not listed here (D18); the report shows them (G1). */}
          <Link to="/reports/salaries" className="btn btn-outline-secondary">
            Salary report
          </Link>
          <Link
            to="/employees/new"
            state={{ from: backTo }}
            className="btn btn-primary"
          >
            New employee
          </Link>
        </div>
      </div>

      <Row className="g-3 align-items-end mb-3">
        <Col md={12} lg={4}>
          <SearchInput
            key={searchKey}
            label="Search"
            placeholder="Name or employee number"
            onSearch={list.setQ}
          />
        </Col>
        <Col sm={4} lg={2}>
          <CountrySelect
            value={list.filters.country_id ?? ""}
            onChange={(value) => list.setFilter("country_id", value || null)}
          />
        </Col>
        <Col sm={4} lg={2}>
          <DepartmentSelect
            value={list.filters.department_id ?? ""}
            onChange={(value) => list.setFilter("department_id", value || null)}
          />
        </Col>
        <Col sm={4} lg={2}>
          <EmploymentStatusSelect
            label="Status"
            value={list.filters.employment_status ?? ""}
            onChange={(value) =>
              list.setFilter("employment_status", value || null)
            }
          />
        </Col>
        <Col lg={2}>
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

      <DataTable<EmployeeSummary>
        caption="Employees"
        columns={columns}
        rows={employees.data?.data}
        rowKey={(employee) => employee.id}
        sort={list.sort}
        onSortChange={list.setSort}
        isLoading={employees.isPending}
        isFetching={employees.isFetching && !employees.isPending}
        error={employees.isError ? employees.error : undefined}
        onRetry={() => void employees.refetch()}
        emptyMessage={
          hasFilters
            ? "No employees match these filters."
            : "There are no employees yet."
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

      {employees.data && employees.data.meta.total_count > 0 && (
        <Pagination
          meta={employees.data.meta}
          onPageChange={list.setPage}
          onPerPageChange={list.setPerPage}
        />
      )}
    </>
  );
}
