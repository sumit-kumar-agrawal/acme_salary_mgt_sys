import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { setCsrfToken } from "@/services/api";
import { mockEmployeeList } from "@/test/fixtures/employees";
import { mockCsvExport, mockSalaryReport } from "@/test/fixtures/salaryReport";
import { mockSessionBackend } from "@/test/fixtures/sessionBackend";
import { currentLocation, renderWithProviders } from "@/test/render";

// Salary report and CSV export (FRONTEND_PLAN.md V1, V3–V5, V10, V11; API §9).

interface SavedFile {
  href: string;
  download: string;
}
let saved: SavedFile[] = [];
const createObjectURL = vi.fn(() => "blob:report");
const revokeObjectURL = vi.fn();

beforeEach(() => {
  saved = [];
  // jsdom has no object URLs or downloads: record what the page would save instead.
  vi.stubGlobal(
    "URL",
    Object.assign(URL, { createObjectURL, revokeObjectURL }),
  );
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    saved.push({ href: this.href, download: this.download });
  });
});

afterEach(() => {
  setCsrfToken(null);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
});

async function renderReport(
  route = "/reports/salaries",
  options: Parameters<typeof mockSalaryReport>[0] = {},
) {
  mockSessionBackend({ signedIn: true });
  const api = mockSalaryReport(options);
  renderWithProviders(<App />, { route });
  await screen.findByRole("heading", { name: "Salary report" });
  return { api, user: userEvent.setup() };
}

describe("SalaryReportPage", () => {
  it("is linked from the sidebar and the employee list, with the applied date", async () => {
    mockSessionBackend({ signedIn: true });
    mockEmployeeList();
    mockSalaryReport();
    renderWithProviders(<App />, { route: "/employees" });
    const user = userEvent.setup();

    const nav = await screen.findByRole("navigation", { name: "Main" });
    expect(
      within(nav).getByRole("link", { name: "Salary report" }),
    ).toHaveAttribute("href", "/reports/salaries");
    await user.click(
      within(screen.getByRole("main")).getByRole("link", {
        name: "Salary report",
      }),
    );

    expect(currentLocation()).toBe("/reports/salaries");
    expect(
      await screen.findByText("Monthly salaries in effect on 2026-09-28."),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(document.title).toBe("Salary report · Salary Management"),
    );
  });

  it("shows the documented columns, each amount in its own currency, and links to the employee", async () => {
    await renderReport();

    const table = await screen.findByRole("table", { name: "Salary report" });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((th) => th.textContent?.replace(/[▲▼↕]/g, "")),
    ).toEqual([
      "Employee number",
      "Name",
      "Country",
      "Department",
      "Status",
      "Monthly amount",
      "Effective from",
    ]);
    const rows = within(table).getAllByRole("row").slice(1);
    expect(
      rows.map((row) =>
        within(row)
          .getAllByRole("cell")
          .map((cell) => cell.textContent),
      ),
    ).toEqual([
      [
        "EMP-00101",
        "Rao, Asha",
        "India",
        "Engineering",
        "Active",
        "85,000.00 INR",
        "2026-04-01",
      ],
      [
        "EMP-00102",
        "Becker, Jonas",
        "Germany",
        "Finance",
        "On leave",
        "5,500.00 EUR",
        "2025-01-01",
      ],
    ]);
    expect(
      within(table).getByRole("link", { name: "EMP-00102" }),
    ).toHaveAttribute("href", "/employees/102");
    expect(table).not.toHaveTextContent(/@|total/i);
    expect(screen.getByText("2 employees.")).toBeInTheDocument();
  });

  it("sorts by amount on the server and says amounts are ordered within each currency", async () => {
    const { api, user } = await renderReport();
    await screen.findByRole("table", { name: "Salary report" });

    await user.click(screen.getByRole("button", { name: "Monthly amount" }));

    await waitFor(() =>
      expect(api.lastQuery()).toMatchObject({ sort: "amount" }),
    );
    expect(currentLocation()).toBe("/reports/salaries?sort=amount");
    expect(
      await screen.findByText(
        "2 employees. Sorted by amount within each currency (currencies A–Z).",
      ),
    ).toBeInTheDocument();
  });

  it("filters, searches, and pages with the report's own defaults", async () => {
    const { api, user } = await renderReport("/reports/salaries", {
      total: 60,
    });

    expect(await screen.findByText("Showing 1–25 of 60")).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toHaveDisplayValue(
      "Active and on leave (default)",
    );
    expect(api.lastQuery()).toEqual({
      page: "1",
      per_page: "25",
      sort: "employee_number",
    });

    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(api.lastQuery()).toMatchObject({ page: "2" }));

    await user.selectOptions(screen.getByLabelText("Country"), "India");
    await user.type(screen.getByLabelText("As of"), "2025-12-31");
    await user.type(screen.getByLabelText("Search"), "Rao");
    await waitFor(() =>
      expect(api.lastQuery()).toEqual({
        page: "1",
        per_page: "25",
        sort: "employee_number",
        country_id: "5",
        as_of: "2025-12-31",
        q: "Rao",
      }),
    );
    // The search text never reaches the URL.
    expect(currentLocation()).toBe(
      "/reports/salaries?country_id=5&as_of=2025-12-31",
    );
  });

  it("shows an empty state that offers Clear filters", async () => {
    const { user } = await renderReport("/reports/salaries?country_id=5", {
      rows: [],
    });

    expect(
      await screen.findByText("No salaries match these filters."),
    ).toBeInTheDocument();
    const empty = screen.getByText("No salaries match these filters.");
    await user.click(
      within(empty.parentElement as HTMLElement).getByRole("button", {
        name: "Clear filters",
      }),
    );
    await waitFor(() => expect(currentLocation()).toBe("/reports/salaries"));
  });

  it("exports the table's filters, search, and sort (not the page) and saves the API's file", async () => {
    const { user } = await renderReport(
      "/reports/salaries?page=2&sort=-amount&department_id=2",
      { total: 60 },
    );
    const csv = mockCsvExport();
    await screen.findByRole("table", { name: "Salary report" });
    await user.type(screen.getByLabelText("Search"), "Rao");
    await waitFor(() =>
      expect(currentLocation()).toBe(
        "/reports/salaries?sort=-amount&department_id=2",
      ),
    );

    await user.click(screen.getByRole("button", { name: "Export CSV" }));

    await waitFor(() => expect(saved).toHaveLength(1));
    expect(csv.lastQuery()).toEqual({
      sort: "-amount",
      department_id: "2",
      q: "Rao",
    });
    expect(saved[0]).toEqual({
      href: "blob:report",
      download: "salary-report-2026-09-28.csv",
    });
    await waitFor(() =>
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:report"),
    );
    expect(screen.getByRole("button", { name: "Export CSV" })).toBeEnabled();
  });

  it("shows the API's message when the export is too large, and saves nothing", async () => {
    const { user } = await renderReport();
    mockCsvExport({ tooLarge: true });
    await screen.findByRole("table", { name: "Salary report" });

    await user.click(screen.getByRole("button", { name: "Export CSV" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Narrow the filters to export at most 10,000 rows.",
    );
    expect(saved).toHaveLength(0);
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("disables Export CSV while the file is being prepared", async () => {
    const { user } = await renderReport();
    mockCsvExport({ delayMs: 100 });
    await screen.findByRole("table", { name: "Salary report" });

    const pending = user.click(
      screen.getByRole("button", { name: "Export CSV" }),
    );
    expect(
      await screen.findByRole("button", { name: "Preparing CSV…" }),
    ).toBeDisabled();
    await pending;
    await waitFor(() => expect(saved).toHaveLength(1));
  });

  it("shows an error with Retry when the report fails to load", async () => {
    await renderReport("/reports/salaries", { fail: true });

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
