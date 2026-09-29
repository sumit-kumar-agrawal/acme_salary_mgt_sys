import {
  demoEmployeeId,
  expect,
  expectNoAxeViolations,
  test,
} from "./support.ts";

// Automated accessibility checks (FRONTEND_PLAN.md X5): axe with the WCAG 2.1 A/AA rules on every page and
// both salary dialogs. Read-only: dialogs are opened and cancelled on a demo employee; nothing is saved.

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("the sign-in page", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expectNoAxeViolations(page, "sign-in");
  });
});

test("the dashboard", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("table", { name: "Employees by department" }),
  ).toBeVisible();
  await expectNoAxeViolations(page, "dashboard");
});

test("the employee list", async ({ page }) => {
  await page.goto("/employees");
  await expect(page.getByText(/^Showing 1–25 of/)).toBeVisible();
  await expectNoAxeViolations(page, "employee list");
});

test("an employee's page and both salary dialogs", async ({ page }) => {
  await page.goto(`/employees/${await demoEmployeeId(page)}`);
  await expect(
    page.getByRole("table", { name: "Salary history" }),
  ).toBeVisible();
  await expectNoAxeViolations(page, "employee detail");

  await page.getByRole("button", { name: "Record salary change" }).click();
  const change = page.getByRole("dialog", { name: "Record salary change" });
  await expect(change).toBeVisible();
  await expectNoAxeViolations(page, "Record salary change dialog");
  await change.getByRole("button", { name: "Cancel" }).click();
  await expect(change).toBeHidden();

  await page
    .getByRole("button", { name: /^Correct salary effective from/ })
    .first()
    .click();
  const correction = page.getByRole("dialog", {
    name: "Correct salary record",
  });
  await expect(correction).toBeVisible();
  await expectNoAxeViolations(page, "Correct salary record dialog");
  await correction.getByRole("button", { name: "Cancel" }).click();
  await expect(correction).toBeHidden();
});

test("the new-employee form showing validation errors", async ({ page }) => {
  await page.goto("/employees/new");
  await expect(page.getByLabel("Country")).toBeEnabled();
  await page.getByRole("button", { name: "Create employee" }).click();
  await expect(page.getByText("is required").first()).toBeVisible();
  await expectNoAxeViolations(page, "new employee with errors");
});

test("analytics", async ({ page }) => {
  await page.goto("/analytics");
  await expect(
    page.getByRole("table", { name: "Breakdown by country" }),
  ).toBeVisible();
  await expect(
    page.getByRole("table", { name: /salary distribution$/ }).first(),
  ).toBeVisible();
  await expectNoAxeViolations(page, "analytics");
});

test("the salary report", async ({ page }) => {
  await page.goto("/reports/salaries");
  await expect(page.getByText(/^Showing 1–25 of/)).toBeVisible();
  await expectNoAxeViolations(page, "salary report");
});

test("the not-found page", async ({ page }) => {
  await page.goto("/no-such-page");
  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
  await expectNoAxeViolations(page, "not found");
});
