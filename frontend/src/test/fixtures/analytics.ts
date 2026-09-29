import { http, HttpResponse } from "msw";
import type {
  AnalyticsBreakdown,
  AnalyticsDistribution,
  AnalyticsSummary,
} from "@/services/analytics.types";
import { server } from "@/test/server";

// Synthetic analytics responses (API spec §8 shapes) and handlers that record each request's query.
// Three currencies with different minor units (INR 2, JPY 0, KWD 3), so amounts must be shown as given.

const ECHO: Pick<AnalyticsSummary, "as_of" | "period" | "filters"> = {
  as_of: "2026-09-28",
  period: "monthly",
  filters: {
    country_id: null,
    department_id: null,
    employment_status: ["active", "on_leave"],
  },
};

export const SUMMARY: AnalyticsSummary = {
  ...ECHO,
  employees_in_scope: 9434,
  employees_without_salary: 94,
  by_currency: [
    {
      currency_code: "INR",
      employee_count: 1180,
      total: "105020000.00",
      average: "89000.00",
      median: "84500.00",
      min: "30000.00",
      max: "450000.00",
    },
    {
      currency_code: "JPY",
      employee_count: 1,
      total: "250000",
      average: "250000",
      median: "250000",
      min: "250000",
      max: "250000",
    },
    {
      currency_code: "KWD",
      employee_count: 2,
      total: "3000.250",
      average: "1500.125",
      median: "1500.125",
      min: "1400.000",
      max: "1600.250",
    },
  ],
};

export const DISTRIBUTION: AnalyticsDistribution = {
  ...ECHO,
  by_currency: [
    {
      currency_code: "INR",
      employee_count: 1180,
      bands: [
        { lower: "30000.00", upper: "72000.00", count: 400 },
        { lower: "72000.00", upper: "114000.00", count: 100 },
        { lower: "114000.00", upper: "156000.00", count: 0 },
      ],
    },
    {
      currency_code: "JPY",
      employee_count: 1,
      bands: [{ lower: "250000", upper: "250000", count: 1 }],
    },
  ],
};

export const BREAKDOWN: AnalyticsBreakdown = {
  ...ECHO,
  by: "country",
  rows: [
    {
      dimension: { id: 3, code: "DE", name: "Germany" },
      currency_code: "EUR",
      employee_count: 1100,
      total: "6050000.00",
      average: "5500.00",
      median: "5300.00",
    },
    {
      dimension: { id: 3, code: "DE", name: "Germany" },
      currency_code: "USD",
      employee_count: 52,
      total: "338000.00",
      average: "6500.00",
      median: "6400.00",
    },
  ],
};

export const DEPARTMENT_BREAKDOWN: AnalyticsBreakdown = {
  ...BREAKDOWN,
  by: "department",
  rows: [
    {
      dimension: { id: 1, name: "Engineering" },
      currency_code: "INR",
      employee_count: 700,
      total: "70000000.00",
      average: "100000.00",
      median: "95000.00",
    },
  ],
};

type Endpoint = "summary" | "distribution" | "breakdown";

interface Options {
  summary?: AnalyticsSummary;
  distribution?: AnalyticsDistribution;
  /** Endpoints that answer 500. */
  fail?: Endpoint[];
}

const failure = () =>
  HttpResponse.json(
    { error: { code: "internal_error", message: "Something went wrong." } },
    { status: 500 },
  );

export function mockAnalytics({
  summary = SUMMARY,
  distribution = DISTRIBUTION,
  fail = [],
}: Options = {}) {
  const queries: Record<Endpoint, Record<string, string>[]> = {
    summary: [],
    distribution: [],
    breakdown: [],
  };
  const record = (endpoint: Endpoint, url: string) => {
    queries[endpoint].push(Object.fromEntries(new URL(url).searchParams));
    return fail.includes(endpoint);
  };
  server.use(
    http.get("*/api/v1/analytics/summary", ({ request }) =>
      record("summary", request.url)
        ? failure()
        : HttpResponse.json({ data: summary }),
    ),
    http.get("*/api/v1/analytics/distribution", ({ request }) =>
      record("distribution", request.url)
        ? failure()
        : HttpResponse.json({ data: distribution }),
    ),
    http.get("*/api/v1/analytics/breakdown", ({ request }) => {
      if (record("breakdown", request.url)) return failure();
      const by = new URL(request.url).searchParams.get("by");
      return HttpResponse.json({
        data: by === "department" ? DEPARTMENT_BREAKDOWN : BREAKDOWN,
      });
    }),
  );
  return {
    queries,
    lastQuery: (endpoint: Endpoint) => queries[endpoint].at(-1) ?? {},
  };
}
