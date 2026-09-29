import { demoEmployeeId, expect, tabTo, test } from "./support.ts";

// Keyboard-only journey (FRONTEND_PLAN.md X6): no mouse clicks. Read-only: the salary dialog is opened and
// closed with Escape; nothing is saved.

test("the app can be used with the keyboard alone", async ({ page }) => {
  await page.goto("/employees");
  await expect(page.getByText(/^Showing 1–25 of/)).toBeVisible();

  // The first Tab reaches the skip link, which moves focus to the main content.
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to main content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();

  // A sort header works with Enter.
  const nameSort = page.getByRole("button", { name: "Name" });
  await tabTo(page, nameSort);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/sort=last_name/);

  // Sidebar links are reachable with Tab (from the top of a page) and open with Enter.
  const analytics = page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Analytics" });
  await page.goto("/employees");
  await tabTo(page, analytics);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/analytics");
  await expect(
    page.getByRole("heading", { name: "Compensation analytics" }),
  ).toBeVisible();

  // A dialog: Enter opens it with focus inside; Escape closes it and focus returns to its button.
  await page.goto(`/employees/${await demoEmployeeId(page)}`);
  const record = page.getByRole("button", { name: "Record salary change" });
  await expect(record).toBeEnabled();
  await tabTo(page, record);
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Record salary change" });
  await expect(dialog).toBeVisible();
  // Focus is on the dialog itself (react-bootstrap focuses its container) or on something inside it.
  await expect(
    page.locator('[role="dialog"]:focus, [role="dialog"] :focus'),
  ).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(record).toBeFocused();
});

test("on a phone, the navigation opens and closes with the keyboard", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/employees");
  await expect(page.getByText(/^Showing 1–25 of/)).toBeVisible();

  const menu = page.getByRole("button", { name: "Menu" });
  await tabTo(page, menu);
  await page.keyboard.press("Enter");
  const navigation = page.getByRole("dialog", { name: "Navigation" });
  await expect(navigation).toBeVisible();
  await expect(
    navigation.getByRole("link", { name: "Dashboard" }),
  ).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(navigation).toBeHidden();
  await expect(menu).toBeFocused();
});
