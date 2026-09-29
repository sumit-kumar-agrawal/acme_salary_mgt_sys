import {
  AUTH_FILE,
  expect,
  hrCredentials,
  signInThroughForm,
  test as setup,
} from "./support.ts";

// Sign in once per run and save the session (R12): the other tests reuse it instead of signing in again.
setup("sign in once and save the session", async ({ page }) => {
  const { email, password } = hrCredentials();

  await page.goto("/");
  await signInThroughForm(page, email, password);

  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
  await page.context().storageState({ path: AUTH_FILE });
});
