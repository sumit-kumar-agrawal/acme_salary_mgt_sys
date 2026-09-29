import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import App from "@/App";
import { setCsrfToken } from "@/services/api";
import { SUMMARY, mockAnalytics } from "@/test/fixtures/analytics";
import { mockSessionBackend } from "@/test/fixtures/sessionBackend";
import { currentLocation, renderWithProviders } from "@/test/render";

// Dashboard at "/": today's headcount and employees by currency, country, and department. Only counts are
// charted; amounts appear as text in their own currency.

afterEach(() => setCsrfToken(null));

async function renderDashboard(
  options: Parameters<typeof mockAnalytics>[0] = {},
) {
  mockSessionBackend({ signedIn: true });
  const api = mockAnalytics(options);
  renderWithProviders(<App />, { route: "/" });
  await screen.findByRole("heading", { name: "Dashboard" });
  return api;
}

const region = (name: string) => screen.getByRole("region", { name });
const tableRows = (table: HTMLElement) =>
  within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    );

describe("DashboardPage", () => {
  it("is the home page, first in the sidebar, with today's date from the API and no filters sent", async () => {
    const api = await renderDashboard();

    expect(currentLocation()).toBe("/");
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getAllByRole("link")[0]).toHaveTextContent("Dashboard");
    expect(
      within(nav).getByRole("link", { name: "Dashboard" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      await screen.findByText(
        "Active and on-leave employees, as of 2026-09-28.",
      ),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(document.title).toBe("Dashboard · Salary Management"),
    );
    expect(api.lastQuery("summary")).toEqual({});
    expect(api.queries.breakdown.map((query) => query.by).sort()).toEqual([
      "country",
      "department",
    ]);
  });

  it("shows the headcount tiles", async () => {
    await renderDashboard();

    const headcount = region("Headcount");
    expect(await within(headcount).findByText("9,434")).toBeInTheDocument();
    expect(headcount).toHaveTextContent(
      "Employees9,434With a salary today9,340Currencies paid3",
    );
  });

  it("charts employees per currency, with each average as text in its own currency and no total", async () => {
    await renderDashboard();

    const table = await within(region("Employees by currency")).findByRole(
      "table",
      { name: "Employees by currency" },
    );
    expect(tableRows(table)).toEqual([
      ["INR", "1,180", "89,000.00 INR"],
      ["JPY", "1", "250,000 JPY"],
      ["KWD", "2", "1,500.125 KWD"],
    ]);
    const widths = within(table)
      .getAllByTestId("count-bar")
      .map((bar) => bar.style.width);
    expect(widths[0]).toBe("100%");
    expect(parseFloat(widths[1] ?? "")).toBeCloseTo((1 / 1180) * 100);
    expect(region("Employees by currency")).not.toHaveTextContent(
      /grand total|all currencies/i,
    );
  });

  it("counts employees per country and per department, adding up each dimension's currencies", async () => {
    await renderDashboard();

    const byCountry = await within(region("Employees by country")).findByRole(
      "table",
      { name: "Employees by country" },
    );
    // Germany has EUR (1,100) and USD (52) rows in the API's breakdown: one headcount of 1,152.
    expect(tableRows(byCountry)).toEqual([["Germany", "1,152"]]);

    const byDepartment = await within(
      region("Employees by department"),
    ).findByRole("table", { name: "Employees by department" });
    expect(tableRows(byDepartment)).toEqual([["Engineering", "700"]]);
  });

  it("shows empty states when no salary is in effect today", async () => {
    await renderDashboard({
      summary: {
        ...SUMMARY,
        employees_in_scope: 0,
        employees_without_salary: 0,
        by_currency: [],
      },
    });

    expect(
      await within(region("Employees by currency")).findByText(
        "No salaries in effect today.",
      ),
    ).toBeInTheDocument();
    expect(region("Headcount")).toHaveTextContent("Currencies paid0");
  });

  it("shows a failed section's error with Retry while the rest still shows", async () => {
    await renderDashboard({ fail: ["breakdown"] });

    expect(
      await within(region("Employees by country")).findByRole("alert"),
    ).toBeInTheDocument();
    expect(
      await within(region("Employees by department")).findByRole("alert"),
    ).toBeInTheDocument();
    expect(
      within(region("Employees by currency")).getByRole("table"),
    ).toBeInTheDocument();
    expect(
      within(region("Employees by country")).getByRole("button", {
        name: "Retry",
      }),
    ).toBeInTheDocument();
  });
});
