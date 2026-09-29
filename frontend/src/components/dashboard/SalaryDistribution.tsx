import Col from "react-bootstrap/Col";
import Row from "react-bootstrap/Row";
import EmptyState from "@/components/common/EmptyState";
import ErrorAlert from "@/components/common/ErrorAlert";
import LoadingState from "@/components/common/LoadingState";
import { formatEmployeeCount, formatMoney } from "@/components/common/format";
import CountBars from "@/components/dashboard/CountBars";
import { useAnalyticsDistribution } from "@/components/dashboard/useAnalytics";
import type { CurrencyDistribution } from "@/services/analytics.types";
import type { QueryParams } from "@/services/api";

// Salary distribution (FRONTEND_PLAN.md V8 a; API §8.3): one CountBars table per currency, so each
// currency's bars have their own scale and are never compared across currencies.

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
  return (
    <section aria-labelledby={`distribution-${code}`}>
      <h3 id={`distribution-${code}`} className="h6">
        {code}: {formatEmployeeCount(currency.employee_count)}
      </h3>
      <CountBars
        caption={`${code} salary distribution`}
        labelHeader="Monthly amount"
        rows={currency.bands.map((band, index) => ({
          // Keyed by position: rounded edges can repeat when a currency's range is tiny.
          key: String(index),
          label: `${formatMoney(band.lower)}–${formatMoney(band.upper)} ${code}`,
          count: band.count,
        }))}
      />
    </section>
  );
}
