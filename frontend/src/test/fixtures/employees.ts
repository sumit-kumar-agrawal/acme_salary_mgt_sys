import { http, HttpResponse } from "msw";
import type { EmployeeSummary } from "@/services/employee.types";
import { server } from "@/test/server";

// Synthetic employees (API spec §6.1 shape) and a list endpoint that records each request's query.

export const EMPLOYEES: EmployeeSummary[] = [
  {
    id: 101,
    employee_number: "EMP-00101",
    first_name: "Asha",
    last_name: "Rao",
    country: { id: 5, code: "IN", name: "India" },
    department: { id: 1, name: "Engineering" },
    employment_status: "active",
    hired_on: "2021-04-12",
  },
  {
    id: 102,
    employee_number: "EMP-00102",
    first_name: "Jonas",
    last_name: "Becker",
    country: { id: 3, code: "DE", name: "Germany" },
    department: { id: 2, name: "Finance" },
    employment_status: "on_leave",
    hired_on: null,
  },
];

interface Options {
  rows?: EmployeeSummary[];
  /** Total across all pages (defaults to rows.length). */
  total?: number;
  fail?: boolean;
}

export function mockEmployeeList({
  rows = EMPLOYEES,
  total,
  fail = false,
}: Options = {}) {
  const queries: Record<string, string>[] = [];
  server.use(
    http.get("*/api/v1/employees", ({ request }) => {
      const params = new URL(request.url).searchParams;
      queries.push(Object.fromEntries(params));
      if (fail) {
        return HttpResponse.json(
          {
            error: { code: "internal_error", message: "Something went wrong." },
          },
          { status: 500 },
        );
      }
      const page = Number(params.get("page") ?? 1);
      const perPage = Number(params.get("per_page") ?? 25);
      const count = total ?? rows.length;
      return HttpResponse.json({
        data: rows,
        meta: {
          page,
          per_page: perPage,
          total_count: count,
          total_pages: Math.ceil(count / perPage),
        },
      });
    }),
  );
  return { queries, lastQuery: () => queries.at(-1) ?? {} };
}
