# ADR 002: Preserve Currency Context in Salary Data and Analytics

- **Status:** Proposed
- **Date:** 2026-09-28

## Context

Employees may be paid in different currencies. A raw sum across currencies would be misleading without a defined conversion policy.

## Decision

Store each salary amount with a currency code. Report monetary totals grouped by currency. Do not convert currencies or produce a combined monetary total in the initial scope.

## Rationale

- Prevents invalid comparisons and aggregation.
- Avoids inventing exchange-rate sources, conversion dates, and accounting policy.
- Meets the stated salary-management scope.

## Consequences

- Dashboard totals may show multiple currency groups.
- Average and median should be calculated within a currency or another explicitly comparable cohort.
- If conversion is later required, define rate source, rate date, rounding, and reporting policy before implementation.

## Alternatives considered

- Convert everything to one base currency: deferred because no base currency or FX policy was specified.
