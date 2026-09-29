import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse } from "msw";
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

// New employee (FRONTEND_PLAN.md T7, T8, T10; API §6.3).

afterEach(() => setCsrfToken(null));

async function renderCreate(
  writes: Parameters<typeof mockEmployeeWrites>[0] = {
    created: employeeDetail({ id: 777 }),
  },
) {
  mockSessionBackend({ signedIn: true });
  mockEmployeeDetail(employeeDetail({ id: 777 }));
  const api = mockEmployeeWrites(writes);
  renderWithProviders(<App />, { route: "/employees/new" });
  await screen.findByRole("heading", { name: "New employee" });
  const user = userEvent.setup();
  await screen.findByRole("option", { name: "India" });
  return { api, user };
}

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Employee number"), "EMP-10001");
  await user.type(screen.getByLabelText("First name"), "Asha");
  await user.type(screen.getByLabelText("Last name"), "Rao");
  await user.selectOptions(screen.getByLabelText("Country"), "India");
  await user.selectOptions(screen.getByLabelText("Department"), "Engineering");
}

describe("EmployeeCreatePage", () => {
  it("checks required fields before sending anything", async () => {
    const { api, user } = await renderCreate();

    await user.click(screen.getByRole("button", { name: "Create employee" }));

    expect(
      screen.getByLabelText("Employee number"),
    ).toHaveAccessibleDescription(/is required/);
    expect(screen.getByLabelText("Country")).toHaveAccessibleDescription(
      "is required",
    );
    expect(api.bodies).toEqual([]);
  });

  it("creates an employee and opens their page with a notice", async () => {
    const { api, user } = await renderCreate();
    await fillRequired(user);

    await user.click(screen.getByRole("button", { name: "Create employee" }));

    expect(await screen.findByText("Employee created.")).toBeInTheDocument();
    expect(currentLocation()).toBe("/employees/777");
    expect(api.bodies).toEqual([
      {
        method: "POST",
        body: {
          employee: {
            employee_number: "EMP-10001",
            first_name: "Asha",
            last_name: "Rao",
            country_id: 5,
            department_id: 1,
            employment_status: "active",
          },
        },
      },
    ]);
  });

  it("adds an initial salary in the same request, starting on the hire date by default (T8)", async () => {
    const { api, user } = await renderCreate();
    await fillRequired(user);
    await user.type(screen.getByLabelText("Hired on (optional)"), "2026-10-01");

    await user.click(
      screen.getByLabelText("Add an initial salary (monthly gross base pay)"),
    );
    expect(screen.getByLabelText("Effective from")).toHaveValue("2026-10-01");
    expect(screen.getByLabelText("Monthly amount")).toHaveAttribute(
      "inputMode",
      "decimal",
    );
    await user.type(screen.getByLabelText("Monthly amount"), "85000.50");
    await user.selectOptions(
      screen.getByLabelText("Currency"),
      "INR — Indian Rupee",
    );
    await user.click(screen.getByRole("button", { name: "Create employee" }));

    await screen.findByText("Employee created.");
    expect(api.bodies[0]?.body).toMatchObject({
      employee: {
        hired_on: "2026-10-01",
        initial_salary: {
          amount: "85000.50",
          currency_code: "INR",
          effective_from: "2026-10-01",
        },
      },
    });
  });

  it("shows the API's validation errors next to the matching fields, including the salary", async () => {
    const { user } = await renderCreate({
      createResponse: () =>
        validationFailed({
          employee_number: ["has already been taken"],
          "initial_salary.amount": [
            "must have at most 0 decimal places for this currency",
          ],
        }),
    });
    await fillRequired(user);
    await user.click(
      screen.getByLabelText("Add an initial salary (monthly gross base pay)"),
    );
    await user.type(screen.getByLabelText("Monthly amount"), "250000.5");
    await user.selectOptions(
      screen.getByLabelText("Currency"),
      "JPY — Japanese Yen",
    );
    await user.type(screen.getByLabelText("Effective from"), "2026-10-01");

    await user.click(screen.getByRole("button", { name: "Create employee" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Please correct the highlighted fields.",
    );
    expect(
      screen.getByLabelText("Employee number"),
    ).toHaveAccessibleDescription(/has already been taken/);
    expect(screen.getByLabelText("Monthly amount")).toHaveAccessibleDescription(
      /must have at most 0 decimal places for this currency/,
    );
    expect(currentLocation()).toBe("/employees/new");
  });

  it("shows only a generic message for a server error and keeps the form filled", async () => {
    const { user } = await renderCreate({
      createResponse: () =>
        HttpResponse.json(
          {
            error: {
              code: "internal_error",
              message: "PG::Error at employees_controller.rb:12",
            },
          },
          { status: 500 },
        ),
    });
    await fillRequired(user);

    await user.click(screen.getByRole("button", { name: "Create employee" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Please try again.",
    );
    expect(screen.getByRole("main")).not.toHaveTextContent(/PG::|\.rb/);
    expect(currentLocation()).toBe("/employees/new");
    expect(screen.getByLabelText("Employee number")).not.toHaveValue("");
  });

  it("Cancel returns to the employee list", async () => {
    const { user } = await renderCreate();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(currentLocation()).toBe("/employees"));
  });

  it("is reached from the New employee button on the list", async () => {
    mockSessionBackend({ signedIn: true });
    renderWithProviders(<App />, { route: "/employees" });

    await userEvent.click(
      await screen.findByRole("link", { name: "New employee" }),
    );

    expect(
      await screen.findByRole("heading", { name: "New employee" }),
    ).toBeInTheDocument();
  });
});
