import { expect, test } from "@playwright/test";

// F7.1 journey on the real API and demo data (FRONTEND_PLAN.md V12). Read-only: the page's figures are
// compared with the API's own answer for the same filters, fetched with the same signed-in session.

interface CurrencySummary {
  currency_code: string;
  employee_count: number;
  total: string;
  average: string;
  median: string;
  min: string;
  max: string;
}

/** Thousands separators, as MoneyAmount shows them ("6050000.00" → "6,050,000.00"). */
const grouped = (amount: string) =>
  amount.replace(
    /^(-?)(\d+)/,
    (_, sign: string, whole: string) =>
      `${sign}${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`,
  );

test("analytics filtered by country match the API's figures for the same filters", async ({
  page,
}) => {
  await page.goto("/employees");
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Analytics" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Compensation analytics" }),
  ).toBeVisible();

  const countries = (await (
    await page.request.get("/api/v1/countries")
  ).json()) as { data: { id: number; name: string }[] };
  const germany = countries.data.find((country) => country.name === "Germany");
  expect(germany).toBeDefined();

  await page
    .getByLabel("Country", { exact: true })
    .selectOption({ label: "Germany" });
  await expect(page).toHaveURL(`/analytics?country_id=${germany?.id}`);

  const query = `country_id=${germany?.id}`;
  const summary = (
    (await (
      await page.request.get(`/api/v1/analytics/summary?${query}`)
    ).json()) as {
      data: {
        as_of: string;
        employees_in_scope: number;
        by_currency: CurrencySummary[];
      };
    }
  ).data;
  expect(summary.by_currency.length).toBeGreaterThan(0);

  await expect(
    page.getByText(`Monthly figures as of ${summary.as_of}, per currency.`),
  ).toBeVisible();

  const summarySection = page.getByRole("region", {
    name: "Summary by currency",
  });
  await expect(summarySection.getByRole("region")).toHaveCount(
    summary.by_currency.length,
  );
  for (const currency of summary.by_currency) {
    const code = currency.currency_code;
    const values = summarySection
      .getByRole("region", { name: `${code} — monthly` })
      .getByRole("definition");
    await expect(values).toHaveText([
      new RegExp(
        `^${currency.employee_count.toLocaleString("en-US")} employees?$`,
      ),
      ...(["total", "average", "median", "min", "max"] as const).map(
        (metric) => `${grouped(currency[metric])} ${code}`,
      ),
    ]);
  }

  const distribution = (
    (await (
      await page.request.get(`/api/v1/analytics/distribution?${query}`)
    ).json()) as { data: { by_currency: { bands: unknown[] }[] } }
  ).data;
  await expect(
    page
      .getByRole("region", { name: "Salary distribution" })
      .getByRole("table"),
  ).toHaveCount(distribution.by_currency.length);

  const breakdown = (
    (await (
      await page.request.get(
        `/api/v1/analytics/breakdown?${query}&by=department`,
      )
    ).json()) as { data: { rows: unknown[] } }
  ).data;
  const breakdownSection = page.getByRole("region", { name: "Breakdown" });
  await breakdownSection.getByText("By department").click();
  await expect(
    breakdownSection
      .getByRole("table", { name: "Breakdown by department" })
      .getByRole("row"),
  ).toHaveCount(breakdown.rows.length + 1);
});
