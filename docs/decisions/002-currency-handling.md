# ADR 002: Preserve Currency Context in Salary Data and Analytics

- **Status:** Accepted
- **Date:** 2026-09-28 (accepted in BACKEND_PLAN.md task 1.3)

## Context

Employees may be paid in different currencies. A raw sum across currencies would be misleading without a defined conversion policy.

## Decision

Store each salary amount with a currency code. Report monetary totals grouped by currency. Do not convert currencies or produce a combined monetary total in the initial scope.

Implementation details (see docs/database-design.md):

- `salary_records.amount` is `DECIMAL(18,4)` and holds the **monthly gross base** salary (D3).
- `currency_code` is a `CHAR(3)` foreign key to `currencies`. The currencies table stores `minor_units` (0–4), and each amount's scale is validated against it (D10).
- Total, average, median, distribution, and breakdown are always partitioned by `currency_code`. The median uses MySQL window functions (D21).
- Aggregates are rounded to the currency's minor units only when serialised.

## Rationale

- Prevents invalid comparisons and aggregation.
- Avoids inventing exchange-rate sources, conversion dates, and accounting policy.
- Meets the stated salary-management scope.

## Consequences

- Dashboard totals may show multiple currency groups.
- Average and median are calculated per currency (and per dimension and currency in breakdowns).
- An employee's salary currency is not tied to their country (D11), so breakdowns are keyed by dimension *and* currency.
- If conversion is later required, define rate source, rate date, rounding, and reporting policy before implementation.

## Alternatives considered

- Convert everything to one base currency: deferred because no base currency or FX policy was specified.
