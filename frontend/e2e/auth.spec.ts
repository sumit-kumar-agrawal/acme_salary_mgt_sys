import { expect, hrCredentials, signInThroughForm, test } from "./support.ts";

// F3.1 journeys against the real API. At most 3 sign-ins per run, including setup (R13).

test("a saved session opens the app without signing in again", async ({
  page,
}) => {
  const { email } = hrCredentials();

  await page.goto("/");

  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
});

test.describe("signed out", () => {
  // A fresh browser context: these tests must not use (or end) the saved session.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("signs in, sees the app, and signs out", async ({ page }) => {
    const { email, password } = hrCredentials();

    await page.goto("/");
    await signInThroughForm(page, email, password);
    await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();

    await expect(page.getByText("You have signed out.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("a wrong password shows the generic error and clears the password", async ({
    page,
  }) => {
    const { email } = hrCredentials();

    await page.goto("/");
    await signInThroughForm(page, email, "definitely-not-the-password");

    await expect(page.getByRole("alert")).toHaveText(
      "Invalid email or password.",
    );
    await expect(page.getByLabel("Password")).toHaveValue("");
  });
});
