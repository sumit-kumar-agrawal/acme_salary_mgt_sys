import { useState } from "react";
import Button from "react-bootstrap/Button";
import Col from "react-bootstrap/Col";
import Row from "react-bootstrap/Row";
import FormField from "@/components/common/FormField";
import {
  CountrySelect,
  DepartmentSelect,
  EmploymentStatusSelect,
} from "@/components/common/ReferenceSelects";
import BreakdownTable from "@/components/dashboard/BreakdownTable";
import SalaryDistribution from "@/components/dashboard/SalaryDistribution";
import SummaryCards from "@/components/dashboard/SummaryCards";
import { useAnalyticsSummary } from "@/components/dashboard/useAnalytics";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useListParams } from "@/hooks/useListParams";
import type { BreakdownDimension } from "@/services/analytics.types";

// Compensation analytics (FRONTEND_PLAN.md V1, V3–V9; API §8). Filters live in the URL; the three sections
// load independently, so one failing request does not hide the others. Every figure is per currency.

export default function AnalyticsPage() {
  useDocumentTitle("Analytics");
  // Only the filters are used: analytics have no paging or sorting.
  const list = useListParams({
    sortFields: [],
    defaultSort: "",
    filters: ["as_of", "country_id", "department_id", "employment_status"],
  });
  const { filters } = list;
  const [by, setBy] = useState<BreakdownDimension>("country");
  // The applied date comes from the API's echo (V5); the summary request is shared with SummaryCards.
  const appliedAsOf = useAnalyticsSummary(filters).data?.as_of;

  return (
    <>
      <div className="d-flex flex-wrap align-items-start justify-content-between gap-2 mb-3">
        <div>
          <h1 className="h3 mb-1">Compensation analytics</h1>
          <p className="text-body-secondary mb-0">
            {appliedAsOf
              ? `Monthly figures as of ${appliedAsOf}, per currency.`
              : "Monthly figures, per currency."}
          </p>
        </div>
        <Button
          variant="outline-secondary"
          onClick={list.clearFilters}
          disabled={Object.keys(filters).length === 0}
        >
          Clear filters
        </Button>
      </div>

      <Row className="g-3 mb-2">
        <Col sm={6} lg={2}>
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
        <Col sm={6} lg={3}>
          <CountrySelect
            value={filters.country_id ?? ""}
            onChange={(value) => list.setFilter("country_id", value || null)}
          />
        </Col>
        <Col sm={6} lg={3}>
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
      </Row>
      <p className="text-body-secondary small mb-4">
        Country, department, and status are each employee&apos;s current values,
        also for a past date.
      </p>

      <section aria-labelledby="summary-heading" className="mb-5">
        <h2 id="summary-heading" className="h5">
          Summary by currency
        </h2>
        <SummaryCards filters={filters} />
      </section>

      <section aria-labelledby="distribution-heading" className="mb-5">
        <h2 id="distribution-heading" className="h5">
          Salary distribution
        </h2>
        <SalaryDistribution filters={filters} />
      </section>

      <section aria-labelledby="breakdown-heading">
        <h2 id="breakdown-heading" className="h5">
          Breakdown
        </h2>
        <BreakdownTable filters={filters} by={by} onByChange={setBy} />
      </section>
    </>
  );
}
