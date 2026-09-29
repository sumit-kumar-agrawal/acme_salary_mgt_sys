import type {
  Country,
  Department,
  EmploymentStatus,
} from "@/services/reference.types";

// Employee shapes (docs/api-specification.md §6).

/** List item (§6.1): no email and no salary (D18). */
export interface EmployeeSummary {
  id: number;
  employee_number: string;
  first_name: string;
  last_name: string;
  country: Country;
  department: Department;
  employment_status: EmploymentStatus;
  hired_on: string | null;
}

/** The salary in effect today (§6.2), monthly gross base pay. */
export interface CurrentSalary {
  id: number;
  amount: string;
  currency_code: string;
  period: "monthly";
  effective_from: string;
  effective_to: string | null;
}

/** Detail (§6.2): adds email, the current salary, and timestamps. */
export interface EmployeeDetail extends EmployeeSummary {
  email: string | null;
  current_salary: CurrentSalary | null;
  created_at: string;
  updated_at: string;
}

/** Optional first salary on create (§6.3, D14); the amount is sent exactly as typed. */
export interface InitialSalaryInput {
  amount: string;
  currency_code: string;
  effective_from: string;
}

/** Create body (§6.3), sent wrapped in `employee`. */
export interface EmployeeInput {
  employee_number: string;
  first_name: string;
  last_name: string;
  email?: string;
  country_id: number;
  department_id: number;
  employment_status?: EmploymentStatus;
  hired_on?: string | null;
  initial_salary?: InitialSalaryInput;
}

/** Update body (§6.4): any subset of the create fields except the initial salary. */
export type EmployeeChanges = Partial<Omit<EmployeeInput, "initial_salary">>;

/** Sort fields the list endpoint accepts (§6.1). */
export const EMPLOYEE_SORT_FIELDS = [
  "employee_number",
  "last_name",
  "hired_on",
  "created_at",
] as const;
