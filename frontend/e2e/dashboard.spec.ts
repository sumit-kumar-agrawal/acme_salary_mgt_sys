import { expect, test } from "./support.ts";

// Dashboard journey on the real API and demo data. Read-only: the home page's counts are compared with the
// API's own answers (same session). Country counts are the breakdown's per-currency counts added up.

interface BreakdownRow {
  dimension: { id: number; name: string };
  employee_count: number;
}

test("the dashboard is the home page and its counts match the API", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Dashboard" }),
  ).toHaveAttribute("aria-current", "page");

  const summary = (
    (await (await page.request.get("/api/v1/analytics/summary")).json()) as {
      data: {
        as_of: string;
        employees_in_scope: number;
        employees_without_salary: number;
        by_currency: { currency_code: string; employee_count: number }[];
      };
    }
  ).data;
  const count = (value: number) => value.toLocaleString("en-US");

  await expect(
    page.getByText(`Active and on-leave employees, as of ${summary.as_of}.`),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Headcount" })).toContainText(
    `Employees${count(summary.employees_in_scope)}With a salary today${count(
      summary.employees_in_scope - summary.employees_without_salary,
    )}Currencies paid${summary.by_currency.length}`,
  );

  const currencyRows = page
    .getByRole("table", { name: "Employees by currency" })
    .locator("tbody tr");
  await expect(currencyRows).toHaveCount(summary.by_currency.length);
  for (const [index, currency] of summary.by_currency.entries()) {
    await expect(currencyRows.nth(index).locator("td").nth(1)).toHaveText(
      count(currency.employee_count),
    );
  }

  const breakdown = (
    (await (
      await page.request.get("/api/v1/analytics/breakdown?by=country")
    ).json()) as { data: { rows: BreakdownRow[] } }
  ).data;
  const byCountry = new Map<string, number>();
  for (const row of breakdown.rows)
    byCountry.set(
      row.dimension.name,
      (byCountry.get(row.dimension.name) ?? 0) + row.employee_count,
    );
  const countryRows = page
    .getByRole("table", { name: "Employees by country" })
    .locator("tbody tr");
  await expect(countryRows).toHaveCount(byCountry.size);
  await expect(countryRows.locator("td:nth-child(2)")).toHaveText(
    [...byCountry.values()].map(count),
  );
});
