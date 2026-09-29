import { http, HttpResponse } from "msw";
import {
  COUNTRIES,
  CURRENCIES,
  DEPARTMENTS,
} from "@/test/fixtures/referenceData";

// App-wide read endpoints that most signed-in screens touch: reference lists, an empty employee list, an
// empty salary history, and empty analytics (the dashboard at "/" reads them).
// Tests override them with server.use(...); any other unmocked request still fails (onUnhandledFrame: "error").
const EMPTY_ANALYTICS = {
  as_of: "2026-09-28",
  period: "monthly",
  filters: {
    country_id: null,
    department_id: null,
    employment_status: ["active", "on_leave"],
  },
};

export const defaultHandlers = [
  http.get("*/api/v1/countries", () => HttpResponse.json({ data: COUNTRIES })),
  http.get("*/api/v1/departments", () =>
    HttpResponse.json({ data: DEPARTMENTS }),
  ),
  http.get("*/api/v1/currencies", () =>
    HttpResponse.json({ data: CURRENCIES }),
  ),
  http.get("*/api/v1/employees/:id/salary_records", () =>
    HttpResponse.json({ data: [] }),
  ),
  http.get("*/api/v1/analytics/summary", () =>
    HttpResponse.json({
      data: {
        ...EMPTY_ANALYTICS,
        employees_in_scope: 0,
        employees_without_salary: 0,
        by_currency: [],
      },
    }),
  ),
  http.get("*/api/v1/analytics/breakdown", ({ request }) =>
    HttpResponse.json({
      data: {
        ...EMPTY_ANALYTICS,
        by: new URL(request.url).searchParams.get("by"),
        rows: [],
      },
    }),
  ),
  http.get("*/api/v1/employees", () =>
    HttpResponse.json({
      data: [],
      meta: { page: 1, per_page: 25, total_count: 0, total_pages: 0 },
    }),
  ),
];
