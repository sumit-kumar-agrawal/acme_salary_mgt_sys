import { expect, test } from "./support.ts";

// F5.3 journeys on the real API (FRONTEND_PLAN.md T11). Creates only EMP-E2E-* employees; demo data is never
// edited. Created employees stay in the development database (FD7; `bin/rails demo:reset` restores the demo data).

test("creates an employee with an initial salary, then edits them", async ({
  page,
}) => {
  const number = `EMP-E2E-${Date.now().toString(36).toUpperCase()}`;

  await page.goto("/employees");
  await page.getByRole("link", { name: "New employee" }).click();
  await page.getByLabel("Employee number").fill(number);
  await page.getByLabel("First name").fill("Test");
  await page.getByLabel("Last name").fill("Playwright");
  await page.getByLabel("Hired on (optional)").fill("2026-09-01");
  await page.getByLabel("Country").selectOption({ label: "India" });
  await page.getByLabel("Department").selectOption({ label: "Engineering" });
  await page
    .getByLabel("Add an initial salary (monthly gross base pay)")
    .check();
  await expect(page.getByLabel("Effective from")).toHaveValue("2026-09-01");
  await page.getByLabel("Monthly amount").fill("85000.00");
  await page
    .getByLabel("Currency")
    .selectOption({ label: "INR — Indian Rupee" });
  await page.getByRole("button", { name: "Create employee" }).click();

  await expect(page.getByText("Employee created.")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    `Playwright, Test (${number})`,
  );
  await expect(
    page.getByRole("region", { name: "Current salary" }),
  ).toContainText("85,000.00 INR / month");

  await page.getByRole("link", { name: "Edit" }).click();
  await page.getByLabel("Department").selectOption({ label: "Finance" });
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByText("Changes saved.")).toBeVisible();
  await expect(page.getByRole("region", { name: "Profile" })).toContainText(
    "Finance",
  );
});

test("shows the API's duplicate-number error on the field and creates nothing", async ({
  page,
}) => {
  await page.goto("/employees/new");
  await page.getByLabel("Employee number").fill("EMP-00001");
  await page.getByLabel("First name").fill("Dup");
  await page.getByLabel("Last name").fill("Check");
  await page.getByLabel("Country").selectOption({ label: "India" });
  await page.getByLabel("Department").selectOption({ label: "Engineering" });
  await page.getByRole("button", { name: "Create employee" }).click();

  await expect(page.getByRole("alert")).toContainText(
    "Please correct the highlighted fields.",
  );
  await expect(page.getByLabel("Employee number")).toHaveAccessibleDescription(
    /has already been taken/,
  );
  await expect(page).toHaveURL("/employees/new");
});
