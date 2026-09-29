import { screen, waitFor, within } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import App from "@/App";
import { setCsrfToken } from "@/services/api";
import {
  DEPARTMENT_BREAKDOWN,
  SUMMARY,
  mockAnalytics,
} from "@/test/fixtures/analytics";
import { mockSessionBackend } from "@/test/fixtures/sessionBackend";
import { currentLocation, renderWithProviders } from "@/test/render";
import { server } from "@/test/server";

// Compensation analytics (FRONTEND_PLAN.md V1, V3–V9; API §8).

afterEach(() => setCsrfToken(null));

async function renderAnalytics(
  route = "/analytics",
  options: Parameters<typeof mockAnalytics>[0] = {},
) {
  mockSessionBackend({ signedIn: true });
  const api = mockAnalytics(options);
  renderWithProviders(<App />, { route });
  await screen.findByRole("heading", { name: "Compensation analytics" });
  return { api, user: userEvent.setup() };
}

const section = (name: string) => screen.getByRole("region", { name });

describe("AnalyticsPage", () => {
  it("is linked from the sidebar and shows the date the API applied", async () => {
    mockSessionBackend({ signedIn: true });
    mockAnalytics();
    renderWithProviders(<App />, { route: "/employees" });
    const user = userEvent.setup();

    const nav = await screen.findByRole("navigation", { name: "Main" });
    await user.click(within(nav).getByRole("link", { name: "Analytics" }));

    expect(currentLocation()).toBe("/analytics");
    expect(
      await screen.findByText(
        "Monthly figures as of 2026-09-28, per currency.",
      ),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(document.title).toBe("Analytics · Salary Management"),
    );
  });

  it("shows one card per currency in API order, amounts as given, and no grand total", async () => {
    await renderAnalytics();

    const summary = section("Summary by currency");
    const cards = await within(summary).findAllByRole("region");
    expect(cards.map((card) => card.getAttribute("aria-labelledby"))).toEqual([
      "summary-INR",
      "summary-JPY",
      "summary-KWD",
    ]);

    const inr = within(summary).getByRole("region", { name: "INR — monthly" });
    expect(
      within(inr)
        .getAllByRole("definition")
        .map((dd) => dd.textContent),
    ).toEqual([
      "1,180 employees",
      "105,020,000.00 INR",
      "89,000.00 INR",
      "84,500.00 INR",
      "30,000.00 INR",
      "450,000.00 INR",
    ]);
    const kwd = within(summary).getByRole("region", { name: "KWD — monthly" });
    expect(kwd).toHaveTextContent("1,500.125 KWD");
    expect(
      within(summary).getByRole("region", { name: "JPY — monthly" }),
    ).toHaveTextContent("Employees1 employeeTotal250,000 JPY");

    // Exactly one "Total" per currency card; nothing adds the currencies together.
    expect(within(summary).getAllByText("Total")).toHaveLength(3);
    expect(summary).not.toHaveTextContent(/grand total|all currencies/i);
    expect(summary).toHaveTextContent(
      "9,434 employees in scope; 94 employees without a salary on this date (not included below).",
    );
  });

  it("shows an empty state when no salary is in effect for the filters", async () => {
    await renderAnalytics("/analytics", {
      summary: {
        ...SUMMARY,
        employees_in_scope: 3,
        employees_without_salary: 3,
        by_currency: [],
      },
    });

    expect(
      await screen.findByText(
        "No salaries in effect for these filters on 2026-09-28.",
      ),
    ).toBeInTheDocument();
  });

  it("applies filters from the URL and the form to every section, without paging or sorting", async () => {
    const { api, user } = await renderAnalytics(
      "/analytics?department_id=2&page=4",
    );
    await within(section("Summary by currency")).findAllByRole("region");

    for (const endpoint of ["summary", "distribution", "breakdown"] as const)
      expect(api.lastQuery(endpoint)).toMatchObject({ department_id: "2" });

    await user.selectOptions(await screen.findByLabelText("Country"), "India");
    await user.selectOptions(screen.getByLabelText("Status"), "Terminated");
    await waitFor(() =>
      expect(api.lastQuery("distribution")).toEqual({
        department_id: "2",
        country_id: "5",
        employment_status: "terminated",
      }),
    );
    expect(api.lastQuery("summary")).toEqual(api.lastQuery("distribution"));
    expect(api.lastQuery("breakdown")).toEqual({
      ...api.lastQuery("distribution"),
      by: "country",
    });
    expect(currentLocation()).toBe(
      "/analytics?department_id=2&country_id=5&employment_status=terminated",
    );

    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    await waitFor(() => expect(api.lastQuery("summary")).toEqual({}));
    expect(currentLocation()).toBe("/analytics");
  });

  it("labels the default status population and sends the as-of date", async () => {
    const { api, user } = await renderAnalytics();

    const status = screen.getByLabelText("Status");
    expect(status).toHaveDisplayValue("Active and on leave (default)");

    const asOf = screen.getByLabelText("As of");
    expect(asOf).toHaveAccessibleDescription("Empty means today.");
    expect(
      screen.getByText(
        "Country, department, and status are each employee's current values, also for a past date.",
      ),
    ).toBeInTheDocument();
    await user.type(asOf, "2025-12-31");
    await waitFor(() =>
      expect(api.lastQuery("summary")).toEqual({ as_of: "2025-12-31" }),
    );
  });

  it("shows every band per currency with bars scaled within that currency", async () => {
    await renderAnalytics();

    const distribution = section("Salary distribution");
    const inr = await within(distribution).findByRole("table", {
      name: "INR salary distribution",
    });
    const rows = within(inr).getAllByRole("row").slice(1);
    expect(
      rows.map((row) =>
        within(row)
          .getAllByRole("cell")
          .map((cell) => cell.textContent),
      ),
    ).toEqual([
      ["30,000.00–72,000.00 INR", "400"],
      ["72,000.00–114,000.00 INR", "100"],
      ["114,000.00–156,000.00 INR", "0"],
    ]);
    expect(
      within(inr)
        .getAllByTestId("band-bar")
        .map((bar) => bar.style.width),
    ).toEqual(["100%", "25%", "0%"]);

    // JPY's single band is full width on its own scale, not compared with INR's counts.
    const jpy = within(distribution).getByRole("table", {
      name: "JPY salary distribution",
    });
    expect(within(jpy).getByTestId("band-bar").style.width).toBe("100%");
    expect(
      within(distribution).getByRole("heading", { name: "JPY: 1 employee" }),
    ).toBeInTheDocument();
  });

  it("breaks down by country or department, one row per currency, with no sortable columns", async () => {
    const { api, user } = await renderAnalytics();

    const breakdown = section("Breakdown");
    const table = await within(breakdown).findByRole("table", {
      name: "Breakdown by country",
    });
    expect(
      within(table)
        .getAllByRole("row")
        .slice(1)
        .map((row) =>
          within(row)
            .getAllByRole("cell")
            .map((cell) => cell.textContent),
        ),
    ).toEqual([
      [
        "Germany (DE)",
        "EUR",
        "1,100",
        "6,050,000.00 EUR",
        "5,500.00 EUR",
        "5,300.00 EUR",
      ],
      [
        "Germany (DE)",
        "USD",
        "52",
        "338,000.00 USD",
        "6,500.00 USD",
        "6,400.00 USD",
      ],
    ]);
    expect(within(table).queryAllByRole("button")).toHaveLength(0);

    await user.click(within(breakdown).getByLabelText("By department"));
    const byDepartment = await within(breakdown).findByRole("table", {
      name: "Breakdown by department",
    });
    expect(api.lastQuery("breakdown")).toEqual({ by: "department" });
    expect(
      within(byDepartment).getAllByRole("columnheader")[0],
    ).toHaveTextContent("Department");
    expect(byDepartment).toHaveTextContent("Engineering");
  });

  it("never shows country rows under the department header while switching", async () => {
    const { user } = await renderAnalytics();
    const breakdown = section("Breakdown");
    await within(breakdown).findByRole("table", {
      name: "Breakdown by country",
    });
    server.use(
      http.get("*/api/v1/analytics/breakdown", async () => {
        await delay(100);
        return HttpResponse.json({ data: DEPARTMENT_BREAKDOWN });
      }),
    );

    await user.click(within(breakdown).getByLabelText("By department"));

    expect(
      within(breakdown).queryByText("Germany (DE)"),
    ).not.toBeInTheDocument();
    expect(within(breakdown).getByRole("status")).toHaveTextContent("Loading…");
    expect(
      await within(breakdown).findByRole("table", {
        name: "Breakdown by department",
      }),
    ).toHaveTextContent("Engineering");
  });

  it("shows a failed section's error with Retry while the others still show", async () => {
    const { api, user } = await renderAnalytics("/analytics", {
      fail: ["distribution"],
    });

    const distribution = section("Salary distribution");
    expect(await within(distribution).findByRole("alert")).toBeInTheDocument();
    expect(
      await within(section("Summary by currency")).findByRole("region", {
        name: "INR — monthly",
      }),
    ).toBeInTheDocument();
    expect(
      await within(section("Breakdown")).findByRole("table"),
    ).toBeInTheDocument();

    const attempts = api.queries.distribution.length;
    await user.click(
      within(distribution).getByRole("button", { name: "Retry" }),
    );
    await waitFor(() =>
      expect(api.queries.distribution.length).toBeGreaterThan(attempts),
    );
  });
});
