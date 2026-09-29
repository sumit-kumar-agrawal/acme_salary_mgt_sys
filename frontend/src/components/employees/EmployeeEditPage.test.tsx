import { screen, waitFor } from "@testing-library/react";
import type { QueryClient } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import App from "@/App";
import { setCsrfToken } from "@/services/api";
import {
  employeeDetail,
  mockEmployeeDetail,
} from "@/test/fixtures/employeeDetail";
import {
  mockEmployeeWrites,
  validationFailed,
} from "@/test/fixtures/employeeWrites";
import { mockSessionBackend } from "@/test/fixtures/sessionBackend";
import { currentLocation, renderWithProviders } from "@/test/render";

// Edit employee (FRONTEND_PLAN.md T7, T9, T10; API §6.4).

afterEach(() => setCsrfToken(null));

async function renderEdit(
  writes: Parameters<typeof mockEmployeeWrites>[0] = {},
) {
  mockSessionBackend({ signedIn: true });
  mockEmployeeDetail();
  const api = mockEmployeeWrites({
    updated: employeeDetail({ department: { id: 2, name: "Finance" } }),
    ...writes,
  });
  const { queryClient } = renderWithProviders(<App />, {
    route: "/employees/101/edit",
  });
  await screen.findByRole("heading", { name: "Edit Rao, Asha" });
  await screen.findByRole("option", { name: "Finance" });
  return { api, queryClient, user: userEvent.setup() };
}

/** Analytics and report data already on screen elsewhere (e.g. the dashboard) before a write (F9.1 R1). */
function seedAnalyticsAndReports(queryClient: QueryClient) {
  queryClient.setQueryData(["analytics", "summary", {}], { cached: true });
  queryClient.setQueryData(["reports", "salaries", {}], { cached: true });
}

function analyticsAndReportsInvalidated(queryClient: QueryClient) {
  return [
    queryClient.getQueryState(["analytics", "summary", {}])?.isInvalidated,
    queryClient.getQueryState(["reports", "salaries", {}])?.isInvalidated,
  ];
}

describe("EmployeeEditPage", () => {
  it("loads the current values and keeps Save disabled until something changes", async () => {
    await renderEdit();

    expect(screen.getByLabelText("Employee number")).toHaveValue("EMP-00101");
    expect(screen.getByLabelText("Email (optional)")).toHaveValue(
      "asha.rao@example.test",
    );
    expect(screen.getByLabelText("Department")).toHaveValue("1");
    expect(
      screen.queryByLabelText("Add an initial salary (monthly gross base pay)"),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  it("sends only the changed fields and returns to the employee with a notice", async () => {
    const { api, user } = await renderEdit();

    await user.selectOptions(screen.getByLabelText("Department"), "Finance");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Changes saved.")).toBeInTheDocument();
    expect(currentLocation()).toBe("/employees/101");
    expect(api.bodies).toEqual([
      { method: "PATCH", body: { employee: { department_id: 2 } } },
    ]);
  });

  it("marks analytics and reports stale after a change, since they use current department and status", async () => {
    const { queryClient, user } = await renderEdit();
    seedAnalyticsAndReports(queryClient);

    await user.selectOptions(screen.getByLabelText("Status"), "Terminated");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await screen.findByText("Changes saved.");
    expect(analyticsAndReportsInvalidated(queryClient)).toEqual([true, true]);
  });

  it("can clear the email and terminate the employee (no delete)", async () => {
    const { api, user } = await renderEdit();

    await user.clear(screen.getByLabelText("Email (optional)"));
    await user.selectOptions(screen.getByLabelText("Status"), "Terminated");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await screen.findByText("Changes saved.");
    expect(api.bodies[0]?.body).toEqual({
      employee: { email: "", employment_status: "terminated" },
    });
  });

  it("shows the hire-date rule error (I13) under Hired on", async () => {
    const { user } = await renderEdit({
      updateResponse: () =>
        validationFailed({
          hired_on: ["must not be after the first salary start date"],
        }),
    });

    await user.clear(screen.getByLabelText("Hired on (optional)"));
    await user.type(screen.getByLabelText("Hired on (optional)"), "2027-01-01");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Please correct the highlighted fields.",
    );
    expect(
      screen.getByLabelText("Hired on (optional)"),
    ).toHaveAccessibleDescription(
      "must not be after the first salary start date",
    );
    expect(currentLocation()).toBe("/employees/101/edit");
  });

  it("Cancel returns to the employee without saving", async () => {
    const { api, user } = await renderEdit();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(currentLocation()).toBe("/employees/101"));
    expect(api.bodies).toEqual([]);
  });

  it("shows not found for an unknown employee", async () => {
    mockSessionBackend({ signedIn: true });
    mockEmployeeDetail();
    renderWithProviders(<App />, { route: "/employees/999/edit" });

    expect(
      await screen.findByRole("heading", { name: "Employee not found" }),
    ).toBeInTheDocument();
  });

  it("is reached from the Edit button on the employee's page", async () => {
    mockSessionBackend({ signedIn: true });
    mockEmployeeDetail();
    renderWithProviders(<App />, { route: "/employees/101" });

    await userEvent.click(await screen.findByRole("link", { name: "Edit" }));

    expect(
      await screen.findByRole("heading", { name: "Edit Rao, Asha" }),
    ).toBeInTheDocument();
  });
});
