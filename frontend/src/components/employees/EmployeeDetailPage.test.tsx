import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import App from "@/App";
import { setCsrfToken } from "@/services/api";
import {
  employeeDetail,
  mockEmployeeDetail,
} from "@/test/fixtures/employeeDetail";
import { mockEmployeeList } from "@/test/fixtures/employees";
import { mockSessionBackend } from "@/test/fixtures/sessionBackend";
import {
  currentLocation,
  renderWithProviders,
  type InitialRoute,
} from "@/test/render";

// Employee detail (FRONTEND_PLAN.md T5, T6; API §6.2).

afterEach(() => setCsrfToken(null));

function renderDetail(
  route: InitialRoute = "/employees/101",
  detail = employeeDetail(),
) {
  mockSessionBackend({ signedIn: true });
  const api = mockEmployeeDetail(detail);
  renderWithProviders(<App />, { route });
  return api;
}

describe("EmployeeDetailPage", () => {
  it("shows the heading, profile, and page title", async () => {
    renderDetail();

    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(
      "Rao, Asha (EMP-00101)",
    );
    const profile = screen.getByRole("region", { name: "Profile" });
    expect(
      within(profile).getByText("asha.rao@example.test"),
    ).toBeInTheDocument();
    expect(within(profile).getByText("India")).toBeInTheDocument();
    expect(within(profile).getByText("Engineering")).toBeInTheDocument();
    expect(within(profile).getByText("Active")).toBeInTheDocument();
    expect(within(profile).getByText("2021-04-12")).toBeInTheDocument();
    await waitFor(() =>
      expect(document.title).toBe("Rao, Asha · Salary Management"),
    );
  });

  it("shows — for a missing email or hire date", async () => {
    renderDetail(
      "/employees/101",
      employeeDetail({ email: null, hired_on: null }),
    );

    const profile = await screen.findByRole("region", { name: "Profile" });
    expect(within(profile).getAllByText("—")).toHaveLength(2);
  });

  it("shows the current monthly salary with its currency and start date", async () => {
    renderDetail();

    const salary = await screen.findByRole("region", {
      name: "Current salary",
    });
    expect(salary).toHaveTextContent("85,000.00 INR / month");
    expect(salary).toHaveTextContent("Effective from 2026-04-01");
  });

  it("formats other currencies by their own minor units", async () => {
    renderDetail(
      "/employees/101",
      employeeDetail({
        current_salary: {
          id: 9,
          amount: "1500.125",
          currency_code: "KWD",
          period: "monthly",
          effective_from: "2026-01-01",
          effective_to: null,
        },
      }),
    );

    expect(
      await screen.findByRole("region", { name: "Current salary" }),
    ).toHaveTextContent("1,500.125 KWD / month");
  });

  it("says when no salary is in effect today", async () => {
    renderDetail("/employees/101", employeeDetail({ current_salary: null }));

    expect(
      await screen.findByText("No salary in effect today."),
    ).toBeInTheDocument();
  });

  it("shows a generic not-found page for an unknown employee", async () => {
    const api = renderDetail("/employees/999");

    expect(
      await screen.findByRole("heading", { name: "Employee not found" }),
    ).toBeInTheDocument();
    expect(api.requestedIds).toEqual(["999"]);
    expect(screen.getByRole("main")).not.toHaveTextContent("999");
  });

  it("does not request a non-numeric id", async () => {
    const api = renderDetail("/employees/abc");

    expect(
      await screen.findByRole("heading", { name: "Employee not found" }),
    ).toBeInTheDocument();
    expect(api.requestedIds).toEqual([]);
  });

  it("goes back to the filtered list it came from, and only to the employee list", async () => {
    renderDetail({
      pathname: "/employees/101",
      state: { from: "/employees?country_id=5&page=2" },
    });
    expect(
      await screen.findByRole("link", { name: "← Back to employees" }),
    ).toHaveAttribute("href", "/employees?country_id=5&page=2");
  });

  it("falls back to the plain list for a missing or foreign return path", async () => {
    renderDetail({
      pathname: "/employees/101",
      state: { from: "https://evil.example/" },
    });

    expect(
      await screen.findByRole("link", { name: "← Back to employees" }),
    ).toHaveAttribute("href", "/employees");
  });

  it("keeps the list's filters when opening an employee and going back", async () => {
    mockSessionBackend({ signedIn: true });
    mockEmployeeList();
    mockEmployeeDetail();
    renderWithProviders(<App />, { route: "/employees?country_id=5" });
    const user = userEvent.setup();

    await user.click(await screen.findByRole("link", { name: "EMP-00101" }));
    await screen.findByRole("region", { name: "Profile" });
    await user.click(screen.getByRole("link", { name: "← Back to employees" }));

    await waitFor(() =>
      expect(currentLocation()).toBe("/employees?country_id=5"),
    );
  });

  it("shows a notice passed after saving", async () => {
    renderDetail({
      pathname: "/employees/101",
      state: { notice: "Changes saved." },
    });

    expect(await screen.findByText("Changes saved.")).toBeInTheDocument();
  });
});
