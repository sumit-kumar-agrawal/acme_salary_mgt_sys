import type { AppliedAnalyticsFilters } from "@/services/analytics.types";
import type { PaginationMeta } from "@/services/api";
import type { EmploymentStatus } from "@/services/reference.types";

// Salary report shapes (docs/api-specification.md §9.1). One row per employee with a salary in effect on
// as_of; no email (D18). The amount is a decimal string in its own currency.

/** Report sort fields (§9); amount sorting groups rows by currency first. */
export const REPORT_SORT_FIELDS = [
  "employee_number",
  "last_name",
  "amount",
] as const;

export interface SalaryReportRow {
  employee_id: number;
  employee_number: string;
  first_name: string;
  last_name: string;
  country: { code: string; name: string };
  department: { name: string };
  employment_status: EmploymentStatus;
  amount: string;
  currency_code: string;
  period: "monthly";
  effective_from: string;
}

export interface SalaryReportMeta extends PaginationMeta {
  /** The applied date (today, the server's UTC date, when none was sent). */
  as_of: string;
  filters: AppliedAnalyticsFilters & { q: string | null };
}
