import { AxeBuilder } from "@axe-core/playwright";
import { test as base, expect, type Page } from "@playwright/test";

export { expect };

/**
 * Browser messages that are not the app's own logging: a failed request's status line, which the browser
 * prints for every 4xx answer (e.g. a wrong password or a duplicate employee number). It names only the URL.
 */
const BROWSER_NETWORK_MESSAGE =
  /^Failed to load resource: the server responded with a status of 4\d\d/;

/**
 * The E2E test function for every spec (FRONTEND_PLAN.md X2). An automatic privacy guard checks each test:
 * - no console error or warning (the app never logs payloads, salaries, or personal data);
 * - no page URL with the search text `q` (it is often a name);
 * - localStorage and sessionStorage are empty afterwards (session state stays in memory).
 * Problems are reported by kind and location only, never with page data.
 */
export const test = base.extend<{ privacyGuard: void }>({
  privacyGuard: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on("console", (message) => {
        const type = message.type();
        if (
          (type === "error" || type === "warning") &&
          !BROWSER_NETWORK_MESSAGE.test(message.text())
        ) {
          const { url, lineNumber } = message.location();
          problems.push(`console ${type} from ${url}:${lineNumber}`);
        }
      });
      page.on("framenavigated", (frame) => {
        if (frame !== page.mainFrame()) return;
        const url = new URL(frame.url());
        if (url.searchParams.has("q"))
          problems.push(`search text in the page URL ${url.pathname}`);
      });

      await use();

      if (!page.isClosed() && page.url().startsWith("http")) {
        // An expression string: e2e/ is typed for Node, without the DOM library.
        const [local, session] = await page.evaluate<[number, number]>(
          "[localStorage.length, sessionStorage.length]",
        );
        const stored = { localStorage: local, sessionStorage: session };
        for (const [area, count] of Object.entries(stored))
          if (count > 0) problems.push(`${count} item(s) in ${area}`);
      }
      expect(problems, "privacy guard (FRONTEND_PLAN.md X2)").toEqual([]);
    },
    { auto: true },
  ],
});

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

/** WCAG 2.1 level A and AA rules (FRONTEND_PLAN.md X5). */
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

/**
 * Scans the page as it is now with axe and fails on any WCAG 2.1 A/AA violation. The report names each
 * rule and up to three element selectors, never page text.
 */
export async function expectNoAxeViolations(
  page: Page,
  context: string,
): Promise<void> {
  // Wait for CSS transitions (e.g. a dialog fading in): mid-fade text has partial opacity and fails contrast.
  // allSettled: a transition replaced mid-way (cancelled) rejects its promise, which is fine here.
  await page.evaluate(
    "Promise.allSettled(document.getAnimations().map((animation) => animation.finished))",
  );
  const { violations } = await new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    .analyze();
  expect(
    violations.map(
      (violation) =>
        `${violation.id} (${violation.impact ?? "unknown"}): ${violation.nodes
          .slice(0, 3)
          .map((node) => node.target.join(" "))
          .join(
            " | ",
          )}${violation.nodes.length > 3 ? ` (+${violation.nodes.length - 3} more)` : ""}`,
    ),
    `axe WCAG 2.1 AA: ${context}`,
  ).toEqual([]);
}

/** Presses Tab until the target has focus (keyboard-only journeys); fails after `limit` presses. */
export async function tabTo(
  page: Page,
  target: ReturnType<Page["locator"]>,
  limit = 60,
): Promise<void> {
  for (let presses = 0; presses < limit; presses += 1) {
    if ((await target.and(page.locator(":focus")).count()) > 0) return;
    await page.keyboard.press("Tab");
  }
  throw new Error(`Focus did not reach the target within ${limit} Tab presses`);
}

/** The id of the demo employee EMP-00238 (read-only journeys use it; it has current and scheduled records). */
export async function demoEmployeeId(page: Page): Promise<number> {
  const found = (await (
    await page.request.get("/api/v1/employees?q=EMP-00238")
  ).json()) as { data: { id: number }[] };
  const id = found.data[0]?.id;
  if (id === undefined) throw new Error("Demo employee EMP-00238 not found");
  return id;
}
