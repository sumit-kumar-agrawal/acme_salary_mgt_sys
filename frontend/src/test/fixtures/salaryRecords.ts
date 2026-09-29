import { http, HttpResponse } from "msw";
import type { SalaryRecord } from "@/services/salary.types";
import { server } from "@/test/server";

// Synthetic salary history (API spec §7.1 shape), newest first, mixing currencies and all three statuses.

function record(
  overrides: Partial<SalaryRecord> & Pick<SalaryRecord, "id">,
): SalaryRecord {
  return {
    employee_id: 101,
    amount: "85000.00",
    currency_code: "INR",
    period: "monthly",
    effective_from: "2026-04-01",
    effective_to: null,
    status: "current",
    editable: true,
    created_at: "2026-03-20T09:00:00Z",
    updated_at: "2026-03-20T09:00:00Z",
    ...overrides,
  };
}

export const SALARY_HISTORY: SalaryRecord[] = [
  record({
    id: 4,
    amount: "92000.00",
    effective_from: "2027-04-01",
    status: "scheduled",
  }),
  record({
    id: 3,
    amount: "85000.00",
    effective_from: "2026-04-01",
    effective_to: "2027-03-31",
    status: "current",
  }),
  record({
    id: 2,
    amount: "1500.125",
    currency_code: "KWD",
    effective_from: "2025-01-01",
    effective_to: "2026-03-31",
    status: "historical",
    editable: false,
  }),
  record({
    id: 1,
    amount: "250000",
    currency_code: "JPY",
    effective_from: "2021-04-12",
    effective_to: "2024-12-31",
    status: "historical",
    editable: false,
  }),
];

export function mockSalaryRecords({
  records = SALARY_HISTORY,
  fail = false,
}: { records?: SalaryRecord[]; fail?: boolean } = {}) {
  const requests = { count: 0 };
  server.use(
    http.get("*/api/v1/employees/:id/salary_records", () => {
      requests.count += 1;
      if (fail) {
        return HttpResponse.json(
          {
            error: { code: "internal_error", message: "Something went wrong." },
          },
          { status: 500 },
        );
      }
      return HttpResponse.json({ data: records });
    }),
  );
  return requests;
}

type Responder = (body: unknown) => Response;

/** POST (change) and PATCH (correction) salary records, recording each request (API spec §7.3, §7.5). */
export function mockSalaryWrites({
  changeResponse,
  correctResponse,
}: { changeResponse?: Responder; correctResponse?: Responder } = {}) {
  const requests: { method: string; path: string; body: unknown }[] = [];
  const saved = (body: unknown, overrides: Partial<SalaryRecord>) =>
    record({
      id: 99,
      ...((body as { salary_record?: Partial<SalaryRecord> }).salary_record ??
        {}),
      ...overrides,
    });
  server.use(
    http.post("*/api/v1/employees/:id/salary_records", async ({ request }) => {
      const body = await request.json();
      requests.push({
        method: "POST",
        path: new URL(request.url).pathname,
        body,
      });
      if (changeResponse) return changeResponse(body);
      return HttpResponse.json(
        { data: saved(body, { status: "scheduled" }) },
        { status: 201 },
      );
    }),
    http.patch(
      "*/api/v1/employees/:id/salary_records/:recordId",
      async ({ request }) => {
        const body = await request.json();
        requests.push({
          method: "PATCH",
          path: new URL(request.url).pathname,
          body,
        });
        if (correctResponse) return correctResponse(body);
        return HttpResponse.json({ data: saved(body, {}) });
      },
    ),
  );
  return { requests };
}

export function salaryRecordNotEditable(): Response {
  return HttpResponse.json(
    {
      error: {
        code: "salary_record_not_editable",
        message: "Historical salary records cannot be changed.",
      },
    },
    { status: 422 },
  );
}
