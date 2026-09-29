import type {
  EmployeeChanges,
  EmployeeDetail,
  EmployeeInput,
} from "@/services/employee.types";
import type { EmploymentStatus } from "@/services/reference.types";

// Form values and request building for the employee form (FRONTEND_PLAN.md T7–T9). Only basic client checks
// (required fields); formats, uniqueness, and money scale are validated by the API (422 details).

export interface EmployeeFormValues {
  employee_number: string;
  first_name: string;
  last_name: string;
  email: string;
  country_id: string;
  department_id: string;
  employment_status: EmploymentStatus | "";
  hired_on: string;
  /** Create only: whether an initial salary is included (T8). */
  addSalary: boolean;
  amount: string;
  currency_code: string;
  effective_from: string;
}

export type EmployeeFieldName =
  | Exclude<
      keyof EmployeeFormValues,
      "addSalary" | "amount" | "currency_code" | "effective_from"
    >
  | "initial_salary.amount"
  | "initial_salary.currency_code"
  | "initial_salary.effective_from";

export type EmployeeFieldErrors = Partial<Record<EmployeeFieldName, string>>;

export const EMPTY_EMPLOYEE: EmployeeFormValues = {
  employee_number: "",
  first_name: "",
  last_name: "",
  email: "",
  country_id: "",
  department_id: "",
  employment_status: "active",
  hired_on: "",
  addSalary: false,
  amount: "",
  currency_code: "",
  effective_from: "",
};

export function valuesFromEmployee(
  employee: EmployeeDetail,
): EmployeeFormValues {
  return {
    ...EMPTY_EMPLOYEE,
    employee_number: employee.employee_number,
    first_name: employee.first_name,
    last_name: employee.last_name,
    email: employee.email ?? "",
    country_id: String(employee.country.id),
    department_id: String(employee.department.id),
    employment_status: employee.employment_status,
    hired_on: employee.hired_on ?? "",
  };
}

const REQUIRED = "is required";

/** Required-field checks only (the API validates everything else). */
export function requiredFieldErrors(
  values: EmployeeFormValues,
  mode: "create" | "edit",
): EmployeeFieldErrors {
  const errors: EmployeeFieldErrors = {};
  if (!values.employee_number.trim()) errors.employee_number = REQUIRED;
  if (!values.first_name.trim()) errors.first_name = REQUIRED;
  if (!values.last_name.trim()) errors.last_name = REQUIRED;
  if (!values.country_id) errors.country_id = REQUIRED;
  if (!values.department_id) errors.department_id = REQUIRED;
  if (!values.employment_status) errors.employment_status = REQUIRED;
  if (mode === "create" && values.addSalary) {
    if (!values.amount.trim()) errors["initial_salary.amount"] = REQUIRED;
    if (!values.currency_code)
      errors["initial_salary.currency_code"] = REQUIRED;
    if (!values.effective_from)
      errors["initial_salary.effective_from"] = REQUIRED;
  }
  return errors;
}

/** Create body (§6.3). Empty optional fields are left out; the amount is sent exactly as typed (T8). */
export function toCreateInput(values: EmployeeFormValues): EmployeeInput {
  const input: EmployeeInput = {
    employee_number: values.employee_number.trim(),
    first_name: values.first_name.trim(),
    last_name: values.last_name.trim(),
    country_id: Number(values.country_id),
    department_id: Number(values.department_id),
    employment_status: values.employment_status || "active",
  };
  if (values.email.trim()) input.email = values.email.trim();
  if (values.hired_on) input.hired_on = values.hired_on;
  if (values.addSalary) {
    input.initial_salary = {
      amount: values.amount.trim(),
      currency_code: values.currency_code,
      effective_from: values.effective_from,
    };
  }
  return input;
}

/** Update body (§6.4): only the fields that changed (T9). Clearing email sends "", clearing hired_on sends null. */
export function changedFields(
  initial: EmployeeFormValues,
  values: EmployeeFormValues,
): EmployeeChanges {
  const changes: EmployeeChanges = {};
  const text = (
    key: "employee_number" | "first_name" | "last_name" | "email",
  ) => {
    if (values[key].trim() !== initial[key].trim())
      changes[key] = values[key].trim();
  };
  text("employee_number");
  text("first_name");
  text("last_name");
  text("email");
  if (values.country_id !== initial.country_id)
    changes.country_id = Number(values.country_id);
  if (values.department_id !== initial.department_id)
    changes.department_id = Number(values.department_id);
  if (
    values.employment_status !== initial.employment_status &&
    values.employment_status
  ) {
    changes.employment_status = values.employment_status;
  }
  if (values.hired_on !== initial.hired_on)
    changes.hired_on = values.hired_on || null;
  return changes;
}
