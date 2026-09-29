import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import App from "@/App";
import { setCsrfToken } from "@/services/api";
import { mockEmployeeList } from "@/test/fixtures/employees";
import { mockSessionBackend } from "@/test/fixtures/sessionBackend";
import { currentLocation, renderWithProviders } from "@/test/render";

// Employee list (FRONTEND_PLAN.md T1, T4; D18).

afterEach(() => setCsrfToken(null));

async function renderList(
  route = "/employees",
  options: Parameters<typeof mockEmployeeList>[0] = {},
) {
  mockSessionBackend({ signedIn: true });
  const api = mockEmployeeList(options);
  renderWithProviders(<App />, { route });
  await screen.findByRole("heading", { name: "Employees" });
  return { api, user: userEvent.setup() };
}

describe("EmployeeListPage", () => {
  it("is where / leads, with the page title set", async () => {
    await renderList("/");

    expect(currentLocation()).toBe("/employees");
    await waitFor(() =>
      expect(document.title).toBe("Employees · Salary Management"),
    );
  });

  it("shows the documented columns and never email or salary (D18)", async () => {
    await renderList();

    const table = await screen.findByRole("table", { name: "Employees" });
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
      "Hired on",
    ]);
    const firstRow = within(table).getAllByRole("row")[1]!;
    expect(
      within(firstRow)
        .getAllByRole("cell")
        .map((td) => td.textContent),
    ).toEqual([
      "EMP-00101",
      "Rao, Asha",
      "India",
      "Engineering",
      "Active",
      "2021-04-12",
    ]);
    expect(within(table).getByText("—")).toBeInTheDocument(); // missing hire date
    expect(table).not.toHaveTextContent(/@|salary|INR|EUR/i);
  });

  it("links each employee to their detail page", async () => {
    await renderList();

    expect(
      await screen.findByRole("link", { name: "EMP-00102" }),
    ).toHaveAttribute("href", "/employees/102");
  });

  it("filters by country, department, and status, resetting to page 1", async () => {
    const { api, user } = await renderList("/employees?page=3");
    await screen.findByRole("table", { name: "Employees" });

    await user.selectOptions(await screen.findByLabelText("Country"), "India");
    await waitFor(() =>
      expect(api.lastQuery()).toMatchObject({ country_id: "5", page: "1" }),
    );
    await user.selectOptions(screen.getByLabelText("Department"), "Finance");
    await user.selectOptions(screen.getByLabelText("Status"), "On leave");

    await waitFor(() =>
      expect(api.lastQuery()).toMatchObject({
        country_id: "5",
        department_id: "2",
        employment_status: "on_leave",
      }),
    );
    expect(currentLocation()).toBe(
      "/employees?country_id=5&department_id=2&employment_status=on_leave",
    );
  });

  it("searches after typing stops, without putting the search text in the URL", async () => {
    const { api, user } = await renderList();

    await user.type(screen.getByLabelText("Search"), "Rao");

    await waitFor(() => expect(api.lastQuery()).toMatchObject({ q: "Rao" }));
    expect(currentLocation()).toBe("/employees");
  });

  it("sorts on the server when a column header is clicked", async () => {
    const { api, user } = await renderList();
    await screen.findByRole("table", { name: "Employees" });

    await user.click(screen.getByRole("button", { name: "Name" }));

    await waitFor(() =>
      expect(api.lastQuery()).toMatchObject({ sort: "last_name" }),
    );
    expect(currentLocation()).toBe("/employees?sort=last_name");
  });

  it("pages through results", async () => {
    const { api, user } = await renderList("/employees", { total: 60 });

    expect(await screen.findByText("Showing 1–25 of 60")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => expect(api.lastQuery()).toMatchObject({ page: "2" }));
    expect(currentLocation()).toBe("/employees?page=2");
  });

  it("offers Clear filters when filters match nothing", async () => {
    const { api, user } = await renderList("/employees?country_id=3", {
      rows: [],
      total: 0,
    });
    await user.type(screen.getByLabelText("Search"), "Nobody");
    await waitFor(() => expect(api.lastQuery()).toMatchObject({ q: "Nobody" }));

    expect(
      await screen.findByText("No employees match these filters."),
    ).toBeInTheDocument();
    await user.click(
      within(screen.getByRole("status")).getByRole("button", {
        name: "Clear filters",
      }),
    );

    await waitFor(() => expect(currentLocation()).toBe("/employees"));
    await waitFor(() => expect(api.lastQuery()).not.toHaveProperty("q"));
    expect(api.lastQuery()).not.toHaveProperty("country_id");
    expect(screen.getByLabelText("Search")).toHaveValue("");
  });

  it("shows a retryable error when the list cannot be loaded", async () => {
    const { api, user } = await renderList("/employees", { fail: true });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
    const before = api.queries.length;
    await user.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(api.queries.length).toBeGreaterThan(before));
  });
});
