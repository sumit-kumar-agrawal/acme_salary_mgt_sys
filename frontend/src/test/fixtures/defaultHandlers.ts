import { http, HttpResponse } from "msw";
import {
  COUNTRIES,
  CURRENCIES,
  DEPARTMENTS,
} from "@/test/fixtures/referenceData";

// App-wide read endpoints that most signed-in screens touch: reference lists, an empty employee list, and an
// empty salary history.
// Tests override them with server.use(...); any other unmocked request still fails (onUnhandledFrame: "error").
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
  http.get("*/api/v1/employees", () =>
    HttpResponse.json({
      data: [],
      meta: { page: 1, per_page: 25, total_count: 0, total_pages: 0 },
    }),
  ),
];
