import { expect, hrCredentials, signInThroughForm, test } from "./support.ts";

// F3.2 journeys: routing, return after sign-in (R7), not found, and sidebar navigation (R9a).

test("an unknown URL shows the not-found page, and the sidebar leads to the employee list", async ({
  page,
}) => {
  await page.goto("/no-such-page");

  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
  await expect(page).toHaveTitle("Page not found · Salary Management");

  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Employees" })
    .click();

  await expect(page).toHaveURL("/employees");
  await expect(page.getByRole("heading", { name: "Employees" })).toBeVisible();
});

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("a protected URL sends you to sign-in and back to that URL afterwards", async ({
    page,
  }) => {
    const { email, password } = hrCredentials();

    await page.goto("/no-such-page?page=2");
    await expect(page).toHaveURL("/sign-in");

    await signInThroughForm(page, email, password);

    await expect(page).toHaveURL("/no-such-page?page=2");
    await expect(
      page.getByRole("heading", { name: "Page not found" }),
    ).toBeVisible();
  });
});
