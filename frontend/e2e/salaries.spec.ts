import { expect, test } from "@playwright/test";

// F6 journeys on the real API (FRONTEND_PLAN.md U2, U9). F6.1 is read-only on demo data.

test("an employee's page shows their salary history, consistent with the current salary", async ({
  page,
}) => {
  await page.goto("/employees");
  await page.getByLabel("Search", { exact: true }).fill("EMP-00238");
  await page.getByRole("link", { name: "EMP-00238" }).click();

  const history = page.getByRole("table", { name: "Salary history" });
  const rows = history.getByRole("row").filter({ has: page.getByRole("cell") });
  await expect(rows).not.toHaveCount(0);
  expect(await rows.count()).toBeGreaterThan(1);
  for (const status of await rows
    .locator("td:nth-child(4)")
    .allTextContents()) {
    expect(["Current", "Scheduled", "Historical"]).toContain(status);
  }

  // The "Current" row shows the same monthly amount as the Current salary card.
  const currentAmount = await rows
    .filter({ hasText: "Current" })
    .locator("td:nth-child(3)")
    .textContent();
  await expect(
    page.getByRole("region", { name: "Current salary" }),
  ).toContainText(`${currentAmount} / month`);
});

// F6.2 (U9): writes only to a new EMP-E2E-* employee created here; demo employees are never changed.
test("records salary changes that keep history, and corrects a scheduled record", async ({
  page,
}) => {
  const number = `EMP-E2E-${Date.now().toString(36).toUpperCase()}`;
  const nextJanuary = `${new Date().getFullYear() + 1}-01-01`;

  await page.goto("/employees/new");
  await page.getByLabel("Employee number").fill(number);
  await page.getByLabel("First name").fill("Salary");
  await page.getByLabel("Last name").fill("Playwright");
  await page.getByLabel("Hired on (optional)").fill("2025-01-01");
  await page.getByLabel("Country").selectOption({ label: "India" });
  await page.getByLabel("Department").selectOption({ label: "Engineering" });
  await page
    .getByLabel("Add an initial salary (monthly gross base pay)")
    .check();
  await expect(page.getByLabel("Effective from")).toHaveValue("2025-01-01");
  await page.getByLabel("Monthly amount").fill("80000.00");
  await page
    .getByLabel("Currency")
    .selectOption({ label: "INR — Indian Rupee" });
  await page.getByRole("button", { name: "Create employee" }).click();
  await expect(page.getByText("Employee created.")).toBeVisible();

  const history = page.getByRole("table", { name: "Salary history" });
  const rowFrom = (date: string) =>
    history.getByRole("row").filter({ hasText: date });

  async function recordChange(amount: string, effectiveFrom: string) {
    await page.getByRole("button", { name: "Record salary change" }).click();
    const dialog = page.getByRole("dialog", { name: "Record salary change" });
    await expect(dialog.getByLabel("Currency")).toHaveValue("INR");
    await dialog.getByLabel("Monthly amount").fill(amount);
    await dialog.getByLabel("Effective from").fill(effectiveFrom);
    await dialog.getByRole("button", { name: "Record change" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("Salary change recorded.")).toBeVisible();
  }

  // A change from 2026-01-01 closes the first period the day before; history is kept.
  await recordChange("90000.00", "2026-01-01");
  await expect(rowFrom("2025-01-01")).toContainText("2025-12-31");
  await expect(rowFrom("2025-01-01")).toContainText("Historical");
  await expect(rowFrom("2026-01-01")).toContainText("Current");
  await expect(
    page.getByRole("region", { name: "Current salary" }),
  ).toContainText("90,000.00 INR / month");

  // A future change is scheduled; the current salary is unchanged.
  await recordChange("95000.00", nextJanuary);
  await expect(rowFrom(nextJanuary)).toContainText("Scheduled");
  await expect(rowFrom("2026-01-01")).toContainText(
    `${new Date().getFullYear()}-12-31`,
  );

  // Correct the scheduled amount (a data-entry fix, not a new period).
  await page
    .getByRole("button", {
      name: `Correct salary effective from ${nextJanuary}`,
    })
    .click();
  const correction = page.getByRole("dialog", {
    name: "Correct salary record",
  });
  await expect(correction.getByLabel("Monthly amount")).toHaveValue("95000.00");
  await correction.getByLabel("Monthly amount").fill("96000.00");
  await correction.getByRole("button", { name: "Save correction" }).click();
  await expect(correction).toBeHidden();
  await expect(page.getByText("Salary record corrected.")).toBeVisible();
  await expect(rowFrom(nextJanuary)).toContainText("96,000.00 INR");
  await expect(history.getByRole("row")).toHaveCount(4); // header + 3 records

  // The historical record cannot be corrected.
  await expect(
    rowFrom("2025-01-01").getByRole("button", { name: /Correct/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Current salary" }),
  ).toContainText("90,000.00 INR / month");
});
