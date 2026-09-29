import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import App from "@/App";
import { setCsrfToken } from "@/services/api";
import { mockEmployeeDetail } from "@/test/fixtures/employeeDetail";
import { mockSalaryRecords } from "@/test/fixtures/salaryRecords";
import { mockSessionBackend } from "@/test/fixtures/sessionBackend";
import { renderWithProviders } from "@/test/render";

// Salary history on the employee page (FRONTEND_PLAN.md U2, U3, U8; API §7.2; data-display rules).

afterEach(() => setCsrfToken(null));

async function renderHistory(
  options: Parameters<typeof mockSalaryRecords>[0] = {},
) {
  mockSessionBackend({ signedIn: true });
  mockEmployeeDetail();
  const requests = mockSalaryRecords(options);
  renderWithProviders(<App />, { route: "/employees/101" });
  const section = await screen.findByRole("region", { name: "Salary history" });
  return { section, requests };
}

describe("SalaryHistory", () => {
  it("lists every record newest first, each in its own currency and decimal places", async () => {
    const { section } = await renderHistory();

    const table = await within(section).findByRole("table", {
      name: "Salary history",
    });
    const rows = within(table)
      .getAllByRole("row")
      .slice(1)
      .map((row) =>
        within(row)
          .getAllByRole("cell")
          .map((cell) => cell.textContent),
      );
    expect(rows).toEqual([
      ["2027-04-01", "—", "92,000.00 INR", "Scheduled", "Correct"],
      ["2026-04-01", "2027-03-31", "85,000.00 INR", "Current", "Correct"],
      ["2025-01-01", "2026-03-31", "1,500.125 KWD", "Historical", ""],
      ["2021-04-12", "2024-12-31", "250,000 JPY", "Historical", ""],
    ]);
  });

  it("uses the API's status labels with distinct badges", async () => {
    const { section } = await renderHistory();

    await within(section).findByRole("table");
    expect(within(section).getByText("Scheduled")).toHaveClass(
      "bg-info",
      "text-dark",
    );
    expect(within(section).getByText("Current")).toHaveClass("bg-success");
    expect(within(section).getAllByText("Historical")[0]).toHaveClass(
      "bg-secondary",
    );
  });

  it("never totals amounts across records or currencies", async () => {
    const { section } = await renderHistory();

    const table = await within(section).findByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(5); // header + 4 records, no summary row
    expect(section).not.toHaveTextContent(/total/i);
  });

  it("says when there is no salary history yet", async () => {
    const { section } = await renderHistory({ records: [] });

    expect(
      await within(section).findByText("No salary records yet."),
    ).toBeInTheDocument();
  });

  it("shows a retryable error when the history cannot be loaded", async () => {
    const { section, requests } = await renderHistory({ fail: true });

    expect(await within(section).findByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
    const before = requests.count;
    await userEvent.click(
      within(section).getByRole("button", { name: "Retry" }),
    );
    await waitFor(() => expect(requests.count).toBeGreaterThan(before));
  });
});
