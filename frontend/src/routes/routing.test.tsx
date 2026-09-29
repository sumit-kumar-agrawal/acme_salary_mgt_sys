import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import App from "@/App";
import { setCsrfToken } from "@/services/api";
import {
  HR_EMAIL,
  HR_PASSWORD,
  mockSessionBackend,
} from "@/test/fixtures/sessionBackend";
import { currentLocation, renderWithProviders } from "@/test/render";

// Routing and default deny (FRONTEND_PLAN.md R7, R9, F3.2).

afterEach(() => setCsrfToken(null));

async function signIn() {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText("Email"), HR_EMAIL);
  await user.type(screen.getByLabelText("Password"), HR_PASSWORD);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("routing", () => {
  it("sends a signed-out user to /sign-in", async () => {
    mockSessionBackend();
    renderWithProviders(<App />);

    expect(
      await screen.findByRole("heading", { name: "Sign in" }),
    ).toBeInTheDocument();
    expect(currentLocation()).toBe("/sign-in");
  });

  it("returns to the requested page, with its search string, after sign-in", async () => {
    mockSessionBackend();
    renderWithProviders(<App />, { route: "/no-such-page?page=2" });

    await signIn();

    expect(
      await screen.findByRole("heading", { name: "Page not found" }),
    ).toBeInTheDocument();
    expect(currentLocation()).toBe("/no-such-page?page=2");
  });

  it("ignores an external return path and goes to the employee list instead", async () => {
    mockSessionBackend();
    renderWithProviders(<App />, {
      route: { pathname: "/sign-in", state: { from: "//evil.example/steal" } },
    });

    await signIn();

    expect(
      await screen.findByRole("heading", { name: "Employees" }),
    ).toBeInTheDocument();
    expect(currentLocation()).toBe("/employees");
  });

  it("sends a signed-in user away from /sign-in", async () => {
    mockSessionBackend({ signedIn: true });
    renderWithProviders(<App />, { route: "/sign-in" });

    expect(
      await screen.findByRole("heading", { name: "Employees" }),
    ).toBeInTheDocument();
    expect(currentLocation()).toBe("/employees");
  });

  it("shows a generic not-found page for unknown URLs, without echoing the path", async () => {
    mockSessionBackend({ signedIn: true });
    renderWithProviders(<App />, { route: "/no-such-area/<script>" });

    expect(
      await screen.findByRole("heading", { name: "Page not found" }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("main")).queryByText(/script/),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Go to employees" }),
    ).toHaveAttribute("href", "/employees");
  });
});
