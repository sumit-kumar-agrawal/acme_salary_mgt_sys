import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { QueryParams } from "@/services/api";
import { employeeService } from "@/services/employeeService";

// Employee queries (FRONTEND_PLAN.md T3). Lists keep the previous page on screen while the next one loads.

export const employeeKeys = {
  all: ["employees"] as const,
  lists: () => ["employees", "list"] as const,
  list: (query: QueryParams) => ["employees", "list", query] as const,
  detail: (id: number) => ["employees", "detail", id] as const,
};

export function useEmployeeList(query: QueryParams) {
  return useQuery({
    queryKey: employeeKeys.list(query),
    queryFn: () => employeeService.list(query),
    placeholderData: keepPreviousData,
  });
}

/** One employee's detail; not requested for an invalid id. */
export function useEmployee(id: number | null) {
  return useQuery({
    queryKey: employeeKeys.detail(id ?? 0),
    queryFn: () => employeeService.get(id as number),
    enabled: id !== null,
  });
}

/**
 * A positive integer id from the URL, or null (e.g. "/employees/abc"): never sent to the API. At most 15
 * digits, so Number() keeps it exact (F9.1 R4).
 */
export function parseEmployeeId(value: string | undefined): number | null {
  return value && /^[1-9]\d{0,14}$/.test(value) ? Number(value) : null;
}

/** "Back to employees" target: the list URL the user came from (T5), if it is the internal employee list. */
export function employeeListReturnPath(state: unknown): string {
  const from =
    typeof state === "object" &&
    state !== null &&
    "from" in state &&
    typeof state.from === "string"
      ? state.from
      : "";
  return from === "/employees" || from.startsWith("/employees?")
    ? from
    : "/employees";
}
