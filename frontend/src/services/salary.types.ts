// Salary record shapes (docs/api-specification.md §7).

/** Relative to the server's today (§7.1): computed by the API, never by the frontend. */
export type SalaryStatus = "current" | "scheduled" | "historical";

export interface SalaryRecord {
  id: number;
  employee_id: number;
  /** Monthly gross base pay as the API's decimal string, rounded to the currency's minor units. */
  amount: string;
  currency_code: string;
  period: "monthly";
  effective_from: string;
  /** Null when the period is open-ended. */
  effective_to: string | null;
  status: SalaryStatus;
  /** True for current and scheduled records (D4 + O1). */
  editable: boolean;
  created_at: string;
  updated_at: string;
}

/** Salary change (§7.3): the amount is sent exactly as typed (a decimal string, never a float). */
export interface SalaryChangeInput {
  amount: string;
  currency_code: string;
  effective_from: string;
}

/** Correction (§7.5): only amount and/or currency; dates can never be changed. */
export type SalaryCorrectionInput = Partial<
  Pick<SalaryChangeInput, "amount" | "currency_code">
>;
