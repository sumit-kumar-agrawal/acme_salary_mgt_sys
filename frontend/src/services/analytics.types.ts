import type { EmploymentStatus } from "@/services/reference.types";

// Analytics response shapes (docs/api-specification.md §8). Amounts are decimal strings in their own
// currency; counts are numbers. There is no cross-currency total anywhere in the contract.

/** The filters the API applied, echoed in every response (§8.1). */
export interface AppliedAnalyticsFilters {
  country_id: number | null;
  department_id: number | null;
  /** Always an array: ["active", "on_leave"] when no status was requested. */
  employment_status: EmploymentStatus[];
}

interface AnalyticsEcho {
  /** The applied date (today, the server's UTC date, when none was sent). */
  as_of: string;
  period: "monthly";
  filters: AppliedAnalyticsFilters;
}

export interface CurrencySummary {
  currency_code: string;
  employee_count: number;
  total: string;
  average: string;
  median: string;
  min: string;
  max: string;
}

export interface AnalyticsSummary extends AnalyticsEcho {
  employees_in_scope: number;
  /** Employees in scope with no salary in effect on as_of; excluded from every amount. */
  employees_without_salary: number;
  /** Ordered by currency_code. */
  by_currency: CurrencySummary[];
}

export interface DistributionBand {
  lower: string;
  upper: string;
  count: number;
}

export interface CurrencyDistribution {
  currency_code: string;
  employee_count: number;
  /** Ten bands (one if every amount is equal); lower inclusive, upper exclusive except the last. */
  bands: DistributionBand[];
}

export interface AnalyticsDistribution extends AnalyticsEcho {
  by_currency: CurrencyDistribution[];
}

export const BREAKDOWN_DIMENSIONS = ["country", "department"] as const;
export type BreakdownDimension = (typeof BREAKDOWN_DIMENSIONS)[number];

export interface BreakdownRow {
  /** `code` is present for countries only. */
  dimension: { id: number; code?: string; name: string };
  currency_code: string;
  employee_count: number;
  total: string;
  average: string;
  median: string;
}

export interface AnalyticsBreakdown extends AnalyticsEcho {
  by: BreakdownDimension;
  /** Keyed by dimension and currency, ordered by dimension name then currency code (§8.4). */
  rows: BreakdownRow[];
}
