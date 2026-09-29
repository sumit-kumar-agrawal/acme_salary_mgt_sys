import { expect, test } from "@playwright/test";

// F5 journeys on the real API and the 10k demo data (FRONTEND_PLAN.md T11). Read-only: nothing is changed.

test("the employee list searches, filters, sorts, and pages through real data", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Employees" })
    .click();
  await expect(page).toHaveURL("/employees");
  await expect(page.getByText(/^Showing 1–25 of [\d,]+$/)).toBeVisible();

  await page.getByLabel("Search", { exact: true }).fill("EMP-0001");
  await expect(
    page.getByRole("table", { name: "Employees" }).getByRole("link").first(),
  ).toHaveText(/EMP-0001/);
  await expect(page).not.toHaveURL(/q=/); // search text stays out of the URL
  await page.getByRole("button", { name: "Clear search", exact: true }).click();

  await page.getByLabel("Country").selectOption({ label: "India" });
  await expect(page).toHaveURL(/country_id=\d+/);
  await page.getByRole("button", { name: "Name" }).click();
  await expect(page).toHaveURL(/sort=last_name/);
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByText(/^Showing 26–50 of [\d,]+$/)).toBeVisible();
});

test("opening an employee shows their detail, and Back keeps the list's filters", async ({
  page,
}) => {
  await page.goto("/employees");
  await page.getByLabel("Status").selectOption({ label: "On leave" });
  await expect(page).toHaveURL(/employment_status=on_leave/);
  const listUrl = page.url();

  const firstLink = page
    .getByRole("table", { name: "Employees" })
    .getByRole("link")
    .first();
  const number = await firstLink.textContent();
  await firstLink.click();

  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    `(${number})`,
  );
  await expect(page.getByRole("region", { name: "Profile" })).toContainText(
    "On leave",
  );
  await expect(
    page.getByRole("region", { name: "Current salary" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "← Back to employees" }).click();
  await expect(page).toHaveURL(listUrl);
});
