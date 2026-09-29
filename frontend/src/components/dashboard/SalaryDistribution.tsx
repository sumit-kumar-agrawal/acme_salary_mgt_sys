import Col from "react-bootstrap/Col";
import Row from "react-bootstrap/Row";
import Table from "react-bootstrap/Table";
import EmptyState from "@/components/common/EmptyState";
import ErrorAlert from "@/components/common/ErrorAlert";
import LoadingState from "@/components/common/LoadingState";
import {
  formatCount,
  formatEmployeeCount,
  formatMoney,
} from "@/components/common/format";
import { useAnalyticsDistribution } from "@/components/dashboard/useAnalytics";
import type { CurrencyDistribution } from "@/services/analytics.types";
import type { QueryParams } from "@/services/api";

// Salary distribution (FRONTEND_PLAN.md V8 a; API §8.3): one table per currency with a bar per band, and no
// chart library. Bar widths come from the band counts within one currency, so bars are never compared
// across currencies and amounts are never converted to numbers.

export default function SalaryDistribution({
  filters,
}: {
  filters: QueryParams;
}) {
  const distribution = useAnalyticsDistribution(filters);

  if (distribution.isError)
    return (
      <ErrorAlert
        error={distribution.error}
        onRetry={() => void distribution.refetch()}
      />
    );
  if (distribution.isPending)
    return <LoadingState label="Loading distribution…" />;

  const { by_currency: currencies } = distribution.data;
  if (currencies.length === 0)
    return <EmptyState message="No salaries to show for these filters." />;

  return (
    <div aria-busy={distribution.isFetching || undefined}>
      <p className="text-body-secondary small">
        Monthly amounts in ten equal bands per currency. Each band includes its
        lower value and excludes its upper value, except the last, which
        includes both. Bars are scaled within each currency.
      </p>
      <Row xs={1} lg={2} className="g-4">
        {currencies.map((currency) => (
          <Col key={currency.currency_code}>
            <CurrencyBands currency={currency} />
          </Col>
        ))}
      </Row>
    </div>
  );
}

function CurrencyBands({ currency }: { currency: CurrencyDistribution }) {
  const code = currency.currency_code;
  const largest = Math.max(...currency.bands.map((band) => band.count));
  return (
    <section aria-labelledby={`distribution-${code}`}>
      <h3 id={`distribution-${code}`} className="h6">
        {code}: {formatEmployeeCount(currency.employee_count)}
      </h3>
      <Table responsive size="sm" className="align-middle mb-0">
        <caption className="visually-hidden">
          {code} salary distribution
        </caption>
        <thead>
          <tr>
            <th scope="col">Monthly amount</th>
            <th scope="col" className="w-50">
              Employees
            </th>
          </tr>
        </thead>
        <tbody>
          {/* Keyed by position: rounded edges can repeat when a currency's range is tiny. */}
          {currency.bands.map((band, index) => (
            <tr key={index}>
              <td className="text-nowrap">
                {formatMoney(band.lower)}–{formatMoney(band.upper)} {code}
              </td>
              <td>
                <div className="d-flex align-items-center gap-2">
                  <span className="text-end" style={{ minWidth: "3.5rem" }}>
                    {formatCount(band.count)}
                  </span>
                  <div
                    className="bg-primary rounded"
                    data-testid="band-bar"
                    aria-hidden="true"
                    style={{
                      height: "0.75rem",
                      width: `${largest > 0 ? (band.count / largest) * 100 : 0}%`,
                    }}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </section>
  );
}
