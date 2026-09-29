// Reference data shapes (docs/api-specification.md §5) and the employment-status enum (§6.1).

export interface Country {
  id: number;
  code: string;
  name: string;
}

export interface Department {
  id: number;
  name: string;
}

export interface Currency {
  code: string;
  name: string;
  minor_units: number;
}

/** Fixed by the API contract (§6.1); there is no endpoint for it. */
export const EMPLOYMENT_STATUSES = [
  "active",
  "on_leave",
  "terminated",
] as const;
export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number];

export const EMPLOYMENT_STATUS_LABELS: Record<EmploymentStatus, string> = {
  active: "Active",
  on_leave: "On leave",
  terminated: "Terminated",
};

export function isEmploymentStatus(value: string): value is EmploymentStatus {
  return (EMPLOYMENT_STATUSES as readonly string[]).includes(value);
}
