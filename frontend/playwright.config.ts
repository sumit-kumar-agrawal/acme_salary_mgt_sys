import { defineConfig, devices } from "@playwright/test";

// End-to-end tests against the real Rails API and development database (FRONTEND_PLAN.md FD7, R12).
// Playwright starts Vite only; the Rails server must already be running (VITE_PROXY_TARGET for another port).
// Credentials: E2E_HR_EMAIL / E2E_HR_PASSWORD at run time (never committed).

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:5173";
const port = new URL(baseURL).port || "5173";

export default defineConfig({
  testDir: "./e2e",
  // One worker and no retries: the sign-in rate limit is 5 per minute per IP, and runs share one session.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    // Failure traces and screenshots stay in git-ignored folders (test-results, playwright-report).
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    // Signs in once per run and saves the session for the other tests (R12).
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/hr.json",
      },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
