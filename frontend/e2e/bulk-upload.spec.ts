import { readFile } from "node:fs/promises";
import { expect, expectNoAxeViolations, test } from "./support.ts";

test("bulk corrections save valid rows and download the response CSV for errors", async ({
  page,
}) => {
  const session = await page.request.get("/api/v1/session");
  const {
    data: { csrf_token: token },
  } = (await session.json()) as {
    data: { csrf_token: string };
  };
  const countries = (await (
    await page.request.get("/api/v1/countries")
  ).json()) as { data: { id: number }[] };
  const departments = (await (
    await page.request.get("/api/v1/departments")
  ).json()) as { data: { id: number }[] };
  const number = `EMP-E2E-B${Date.now().toString(36).toUpperCase()}`;
  const date = new Date().toISOString().slice(0, 10);
  const created = await page.request.post("/api/v1/employees", {
    headers: { "X-CSRF-Token": token },
    data: {
      employee: {
        employee_number: number,
        first_name: "Synthetic",
        last_name: "Bulk",
        employment_status: "active",
        country_id: countries.data[0]?.id,
        department_id: departments.data[0]?.id,
        hired_on: "2025-01-01",
        initial_salary: {
          amount: "3000",
          currency_code: "INR",
          effective_from: date,
        },
      },
    },
  });
  expect(created.status()).toBe(201);
  const { data: employee } = (await created.json()) as { data: { id: number } };
  await page.goto("/bulk-salary-corrections");
  await expect(
    page.getByRole("heading", { name: "Bulk salary corrections" }),
  ).toBeVisible();
  const name = `bulk-${Date.now()}.csv`;
  await page.getByLabel("Salary corrections file").setInputFiles({
    name,
    mimeType: "text/csv",
    buffer: Buffer.from(
      `employee_number,effective_from,amount,currency_code\n${number},${date},3400,INR\nMISSING-E2E,${date},1,INR\n`,
    ),
  });
  await page.getByRole("button", { name: "Upload file" }).click();
  await expect(page.getByRole("status")).toContainText("Completed with errors");
  const row = page.getByRole("row").filter({ hasText: name });
  const downloadPromise = page.waitForEvent("download");
  await row.getByRole("link", { name: "Download response CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/-response\.csv$/);
  const path = await download.path();
  expect(path).not.toBeNull();
  const csv = await readFile(path, "utf8");
  expect(csv).toContain("MISSING-E2E");
  expect(csv).toContain("employee_number: no employee has this number");
  expect(csv).not.toContain(number);
  const detail = (await (
    await page.request.get(`/api/v1/employees/${employee.id}`)
  ).json()) as { data: { current_salary: { amount: string } } };
  expect(detail.data.current_salary.amount).toBe("3400.00");
  await expectNoAxeViolations(page, "bulk salary corrections");
});
