import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

// F7.2 journey on the real API and demo data (FRONTEND_PLAN.md V12). Read-only: the report is filtered and
// sorted, compared with the API's own answer, and exported; the CSV must hold the same rows in the same order.

const CSV_HEADER =
  "employee_number,first_name,last_name,country_code,country_name,department,employment_status,monthly_amount,currency_code,effective_from";

test("the salary report filters and sorts like the API, and its CSV holds the same rows", async ({
  page,
}) => {
  await page.goto("/employees");
  await page
    .getByRole("main")
    .getByRole("link", { name: "Salary report" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Salary report" }),
  ).toBeVisible();

  await page
    .getByLabel("Country", { exact: true })
    .selectOption({ label: "Germany" });
  await page.getByRole("button", { name: "Monthly amount" }).click();
  await expect(page).toHaveURL(/country_id=\d+&sort=amount$/);
  const query = new URL(page.url()).search.slice(1);

  const api = (await (
    await page.request.get(`/api/v1/reports/salaries?${query}`)
  ).json()) as {
    data: { employee_number: string }[];
    meta: { total_count: number; as_of: string };
  };
  expect(api.meta.total_count).toBeGreaterThan(25);

  await expect(
    page.getByText(`Monthly salaries in effect on ${api.meta.as_of}.`),
  ).toBeVisible();
  await expect(
    page.getByText(
      `${api.meta.total_count.toLocaleString("en-US")} employees. Sorted by amount within each currency (currencies A–Z).`,
    ),
  ).toBeVisible();
  const table = page.getByRole("table", { name: "Salary report" });
  const firstNumbers = table.locator("tbody tr td:first-child");
  await expect(firstNumbers).toHaveText(
    api.data.map((row) => row.employee_number),
  );

  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe(
    `salary-report-${api.meta.as_of}.csv`,
  );

  const lines = (await readFile(await download.path(), "utf8"))
    .replace(/^\uFEFF/, "")
    .trimEnd()
    .split(/\r?\n/);
  expect(lines[0]).toBe(CSV_HEADER);
  expect(lines).toHaveLength(api.meta.total_count + 1);
  // Same order as the table: the first rows of the file are the first page.
  expect(
    lines.slice(1, api.data.length + 1).map((line) => line.split(",")[0]),
  ).toEqual(api.data.map((row) => row.employee_number));
});
