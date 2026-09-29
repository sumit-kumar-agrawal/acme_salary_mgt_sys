import { delay, http, HttpResponse } from "msw";
import type { SalaryReportRow } from "@/services/report.types";
import { server } from "@/test/server";

// Synthetic salary report rows (API spec §9.1 shape), a report endpoint that records each query, and a CSV
// endpoint that answers with a file or with the JSON 422 export_too_large (§9.2).

export const REPORT_ROWS: SalaryReportRow[] = [
  {
    employee_id: 101,
    employee_number: "EMP-00101",
    first_name: "Asha",
    last_name: "Rao",
    country: { code: "IN", name: "India" },
    department: { name: "Engineering" },
    employment_status: "active",
    amount: "85000.00",
    currency_code: "INR",
    period: "monthly",
    effective_from: "2026-04-01",
  },
  {
    employee_id: 102,
    employee_number: "EMP-00102",
    first_name: "Jonas",
    last_name: "Becker",
    country: { code: "DE", name: "Germany" },
    department: { name: "Finance" },
    employment_status: "on_leave",
    amount: "5500.00",
    currency_code: "EUR",
    period: "monthly",
    effective_from: "2025-01-01",
  },
];

interface Options {
  rows?: SalaryReportRow[];
  total?: number;
  fail?: boolean;
}

export function mockSalaryReport({
  rows = REPORT_ROWS,
  total,
  fail = false,
}: Options = {}) {
  const queries: Record<string, string>[] = [];
  server.use(
    http.get("*/api/v1/reports/salaries", ({ request }) => {
      const params = new URL(request.url).searchParams;
      queries.push(Object.fromEntries(params));
      if (fail)
        return HttpResponse.json(
          {
            error: { code: "internal_error", message: "Something went wrong." },
          },
          { status: 500 },
        );
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
          as_of: params.get("as_of") ?? "2026-09-28",
          filters: {
            country_id: null,
            department_id: null,
            employment_status: ["active", "on_leave"],
            q: params.get("q"),
          },
        },
      });
    }),
  );
  return { queries, lastQuery: () => queries.at(-1) ?? {} };
}

export const CSV_BODY =
  "﻿employee_number,first_name,last_name,country_code,country_name,department,employment_status,monthly_amount,currency_code,effective_from\n";

export function mockCsvExport({ tooLarge = false, delayMs = 0 } = {}) {
  const queries: Record<string, string>[] = [];
  server.use(
    http.get("*/api/v1/reports/salaries.csv", async ({ request }) => {
      if (delayMs) await delay(delayMs);
      queries.push(Object.fromEntries(new URL(request.url).searchParams));
      if (tooLarge)
        return HttpResponse.json(
          {
            error: {
              code: "export_too_large",
              message: "Narrow the filters to export at most 10,000 rows.",
            },
          },
          { status: 422 },
        );
      return new HttpResponse(CSV_BODY, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            'attachment; filename="salary-report-2026-09-28.csv"',
        },
      });
    }),
  );
  return { queries, lastQuery: () => queries.at(-1) ?? {} };
}
