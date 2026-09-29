import Card from "react-bootstrap/Card";
import Col from "react-bootstrap/Col";
import Row from "react-bootstrap/Row";
import { Link } from "react-router";
import EmptyState from "@/components/common/EmptyState";
import ErrorAlert from "@/components/common/ErrorAlert";
import LoadingState from "@/components/common/LoadingState";
import MoneyAmount from "@/components/common/MoneyAmount";
import { formatCount } from "@/components/common/format";
import CountBars, { type CountBarRow } from "@/components/dashboard/CountBars";
import {
  useAnalyticsBreakdown,
  useAnalyticsSummary,
} from "@/components/dashboard/useAnalytics";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import type {
  AnalyticsBreakdown,
  BreakdownDimension,
} from "@/services/analytics.types";

// Dashboard, the app's home page: today's headcount (active and on leave, the analytics default) and
// employees by currency, country, and department. Only counts are charted; money appears only as text,
// one currency per row. Uses the same queries as the unfiltered Analytics page, so the two share a cache.

const NO_FILTERS = {};

/** Employees per country or department: the breakdown's per-currency counts added up (counts, not money). */
function headcountRows(breakdown: AnalyticsBreakdown): CountBarRow[] {
  const byDimension = new Map<number, CountBarRow>();
  for (const row of breakdown.rows) {
    const current = byDimension.get(row.dimension.id);
    if (current) current.count += row.employee_count;
    else
      byDimension.set(row.dimension.id, {
        key: String(row.dimension.id),
        label: row.dimension.name,
        count: row.employee_count,
      });
  }
  return [...byDimension.values()]; // API order: by name
}

export default function DashboardPage() {
  useDocumentTitle("Dashboard");
  const summary = useAnalyticsSummary(NO_FILTERS);

  return (
    <>
      <div className="d-flex flex-wrap align-items-start justify-content-between gap-2 mb-3">
        <div>
          <h1 className="h3 mb-1">Dashboard</h1>
          <p className="text-body-secondary mb-0">
            Active and on-leave employees
            {summary.data ? `, as of ${summary.data.as_of}.` : "."}
          </p>
        </div>
        <div className="d-flex gap-2">
          <Link to="/analytics" className="btn btn-outline-secondary">
            Analytics
          </Link>
          <Link to="/reports/salaries" className="btn btn-outline-secondary">
            Salary report
          </Link>
        </div>
      </div>

      <section aria-labelledby="headcount-heading" className="mb-4">
        <h2 id="headcount-heading" className="visually-hidden">
          Headcount
        </h2>
        {summary.isError ? (
          <ErrorAlert
            error={summary.error}
            onRetry={() => void summary.refetch()}
          />
        ) : summary.isPending ? (
          <LoadingState label="Loading headcount…" />
        ) : (
          <Row xs={1} sm={3} className="g-3">
            <StatTile
              label="Employees"
              value={summary.data.employees_in_scope}
            />
            <StatTile
              label="With a salary today"
              value={
                summary.data.employees_in_scope -
                summary.data.employees_without_salary
              }
            />
            <StatTile
              label="Currencies paid"
              value={summary.data.by_currency.length}
            />
          </Row>
        )}
      </section>

      <section aria-labelledby="currency-heading" className="mb-5">
        <h2 id="currency-heading" className="h5">
          Employees by currency
        </h2>
        {summary.isError ? (
          <ErrorAlert
            error={summary.error}
            onRetry={() => void summary.refetch()}
          />
        ) : summary.isPending ? (
          <LoadingState label="Loading currencies…" />
        ) : summary.data.by_currency.length === 0 ? (
          <EmptyState message="No salaries in effect today." />
        ) : (
          <>
            <CountBars
              caption="Employees by currency"
              labelHeader="Currency"
              detailHeader="Average monthly salary"
              rows={summary.data.by_currency.map((currency) => ({
                key: currency.currency_code,
                label: currency.currency_code,
                count: currency.employee_count,
                detail: (
                  <MoneyAmount
                    amount={currency.average}
                    currencyCode={currency.currency_code}
                  />
                ),
              }))}
            />
            <p className="text-body-secondary small mt-2">
              Bars compare how many employees are paid in each currency. Amounts
              are never added or compared across currencies; see{" "}
              <Link to="/analytics">Analytics</Link> for each currency&apos;s
              figures.
            </p>
          </>
        )}
      </section>

      <Row className="g-5">
        <Col lg={6}>
          <HeadcountBy dimension="country" />
        </Col>
        <Col lg={6}>
          <HeadcountBy dimension="department" />
        </Col>
      </Row>
      <p className="text-body-secondary small mt-3">
        Country and department counts include employees with a salary in effect
        today.
      </p>
    </>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <Col>
      <Card className="h-100">
        <Card.Body>
          <div className="text-body-secondary small">{label}</div>
          <div className="fs-3 fw-semibold">{formatCount(value)}</div>
        </Card.Body>
      </Card>
    </Col>
  );
}

const DIMENSION_TITLES: Record<
  BreakdownDimension,
  { title: string; header: string }
> = {
  country: { title: "Employees by country", header: "Country" },
  department: { title: "Employees by department", header: "Department" },
};

function HeadcountBy({ dimension }: { dimension: BreakdownDimension }) {
  const breakdown = useAnalyticsBreakdown(NO_FILTERS, dimension);
  const { title, header } = DIMENSION_TITLES[dimension];
  const headingId = `headcount-${dimension}`;

  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="h5">
        {title}
      </h2>
      {breakdown.isError ? (
        <ErrorAlert
          error={breakdown.error}
          onRetry={() => void breakdown.refetch()}
        />
      ) : breakdown.isPending ? (
        <LoadingState label={`Loading ${title.toLowerCase()}…`} />
      ) : breakdown.data.rows.length === 0 ? (
        <EmptyState message="No salaries in effect today." />
      ) : (
        <CountBars
          caption={title}
          labelHeader={header}
          rows={headcountRows(breakdown.data)}
        />
      )}
    </section>
  );
}
