import { expect, type Page } from "@playwright/test";

/** The saved signed-in session (git-ignored: it holds a live session cookie). */
export const AUTH_FILE = "playwright/.auth/hr.json";

export function hrCredentials(): { email: string; password: string } {
  const email = process.env.E2E_HR_EMAIL;
  const password = process.env.E2E_HR_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "Set E2E_HR_EMAIL and E2E_HR_PASSWORD to run the end-to-end tests.",
    );
  }
  return { email, password };
}

/** Fills and submits the sign-in form (the page must already show it). */
export async function signInThroughForm(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}
