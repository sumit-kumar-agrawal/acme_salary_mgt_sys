import Card from "react-bootstrap/Card";
import Col from "react-bootstrap/Col";
import Row from "react-bootstrap/Row";
import EmptyState from "@/components/common/EmptyState";
import ErrorAlert from "@/components/common/ErrorAlert";
import LoadingState from "@/components/common/LoadingState";
import MoneyAmount from "@/components/common/MoneyAmount";
import { formatEmployeeCount } from "@/components/common/format";
import { useAnalyticsSummary } from "@/components/dashboard/useAnalytics";
import type { CurrencySummary } from "@/services/analytics.types";
import type { QueryParams } from "@/services/api";

// Per-currency summary (FRONTEND_PLAN.md V7; API §8.2). One card per currency in API order, amounts as
// given. There is deliberately no grand total: amounts in different currencies are never added.

const METRICS: {
  key: keyof Omit<CurrencySummary, "currency_code" | "employee_count">;
  label: string;
}[] = [
  { key: "total", label: "Total" },
  { key: "average", label: "Average" },
  { key: "median", label: "Median" },
  { key: "min", label: "Minimum" },
  { key: "max", label: "Maximum" },
];

export default function SummaryCards({ filters }: { filters: QueryParams }) {
  const summary = useAnalyticsSummary(filters);

  if (summary.isError)
    return (
      <ErrorAlert
        error={summary.error}
        onRetry={() => void summary.refetch()}
      />
    );
  if (summary.isPending) return <LoadingState label="Loading summary…" />;

  const { data } = summary;
  return (
    <div aria-busy={summary.isFetching || undefined}>
      <p>
        {formatEmployeeCount(data.employees_in_scope)} in scope
        {data.employees_without_salary > 0 &&
          `; ${formatEmployeeCount(data.employees_without_salary)} without a salary on this date (not included below)`}
        .
      </p>
      {data.by_currency.length === 0 ? (
        <EmptyState
          message={`No salaries in effect for these filters on ${data.as_of}.`}
        />
      ) : (
        <Row xs={1} md={2} xl={3} className="g-3">
          {data.by_currency.map((currency) => (
            <Col key={currency.currency_code}>
              <SummaryCard currency={currency} />
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
}

function SummaryCard({ currency }: { currency: CurrencySummary }) {
  const titleId = `summary-${currency.currency_code}`;
  return (
    <Card as="section" aria-labelledby={titleId} className="h-100">
      <Card.Header>
        <h3 id={titleId} className="h6 mb-0">
          {currency.currency_code} — monthly
        </h3>
      </Card.Header>
      <Card.Body>
        <dl className="row mb-0">
          <dt className="col-5 fw-normal text-body-secondary">Employees</dt>
          <dd className="col-7">
            {formatEmployeeCount(currency.employee_count)}
          </dd>
          {METRICS.map(({ key, label }) => (
            <MetricRow
              key={key}
              label={label}
              amount={currency[key]}
              currencyCode={currency.currency_code}
            />
          ))}
        </dl>
      </Card.Body>
    </Card>
  );
}

function MetricRow({
  label,
  amount,
  currencyCode,
}: {
  label: string;
  amount: string;
  currencyCode: string;
}) {
  return (
    <>
      <dt className="col-5 fw-normal text-body-secondary">{label}</dt>
      <dd className="col-7">
        <MoneyAmount amount={amount} currencyCode={currencyCode} />
      </dd>
    </>
  );
}
