import { http, HttpResponse } from "msw";
import type { EmployeeDetail } from "@/services/employee.types";
import { EMPLOYEES } from "@/test/fixtures/employees";
import { server } from "@/test/server";

// Synthetic employee detail (API spec §6.2 shape).

export function employeeDetail(
  overrides: Partial<EmployeeDetail> = {},
): EmployeeDetail {
  return {
    ...EMPLOYEES[0]!,
    email: "asha.rao@example.test",
    current_salary: {
      id: 456,
      amount: "85000.00",
      currency_code: "INR",
      period: "monthly",
      effective_from: "2026-04-01",
      effective_to: null,
    },
    created_at: "2026-09-28T10:15:00Z",
    updated_at: "2026-09-28T10:15:00Z",
    ...overrides,
  };
}

/** GET /employees/:id returning `detail`, or 404 for any other id. Records requested ids. */
export function mockEmployeeDetail(detail: EmployeeDetail = employeeDetail()) {
  const requestedIds: string[] = [];
  server.use(
    http.get("*/api/v1/employees/:id", ({ params }) => {
      requestedIds.push(String(params.id));
      if (String(params.id) !== String(detail.id)) {
        return HttpResponse.json(
          { error: { code: "not_found", message: "Not found." } },
          { status: 404 },
        );
      }
      return HttpResponse.json({ data: detail });
    }),
  );
  return { requestedIds };
}
