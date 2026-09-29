import {
  apiRequest,
  type DataEnvelope,
  type Paginated,
  type QueryParams,
} from "@/services/api";
import type {
  EmployeeChanges,
  EmployeeDetail,
  EmployeeInput,
  EmployeeSummary,
} from "@/services/employee.types";

// Employee endpoints (API spec §6). There is no delete: termination is a status change.

export const employeeService = {
  /** Paginated, filtered, sorted list (no email or salary). */
  list(query: QueryParams): Promise<Paginated<EmployeeSummary>> {
    return apiRequest<Paginated<EmployeeSummary>>("/employees", { query });
  },

  async get(id: number): Promise<EmployeeDetail> {
    const { data } = await apiRequest<DataEnvelope<EmployeeDetail>>(
      `/employees/${id}`,
    );
    return data;
  },

  /** Creates the employee (and optional initial salary) in one transaction. */
  async create(input: EmployeeInput): Promise<EmployeeDetail> {
    const { data } = await apiRequest<DataEnvelope<EmployeeDetail>>(
      "/employees",
      {
        method: "POST",
        body: JSON.stringify({ employee: input }),
      },
    );
    return data;
  },

  /** Updates only the given fields. */
  async update(id: number, changes: EmployeeChanges): Promise<EmployeeDetail> {
    const { data } = await apiRequest<DataEnvelope<EmployeeDetail>>(
      `/employees/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ employee: changes }),
      },
    );
    return data;
  },
};
