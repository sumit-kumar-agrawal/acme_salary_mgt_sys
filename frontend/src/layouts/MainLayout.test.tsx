import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import App from "@/App";
import { setCsrfToken } from "@/services/api";
import { HR_EMAIL, mockSessionBackend } from "@/test/fixtures/sessionBackend";
import { currentLocation, renderWithProviders } from "@/test/render";
import { setScreenSize } from "@/test/screenSize";

// Layout for signed-in pages (FRONTEND_PLAN.md R9a, R11).

afterEach(() => setCsrfToken(null));

async function renderSignedIn() {
  mockSessionBackend({ signedIn: true });
  renderWithProviders(<App />);
  await screen.findByRole("heading", { name: "Dashboard" });
  return userEvent.setup();
}

describe("MainLayout", () => {
  it("has a skip link to the single main landmark and sets the page title", async () => {
    await renderSignedIn();

    expect(
      screen.getByRole("link", { name: "Skip to main content" }),
    ).toHaveAttribute("href", "#main");
    expect(screen.getByRole("main")).toHaveAttribute("id", "main");
    expect(screen.getAllByRole("main")).toHaveLength(1);
    await waitFor(() =>
      expect(document.title).toBe("Dashboard · Salary Management"),
    );
  });

  it("shows the signed-in user in the header", async () => {
    await renderSignedIn();

    expect(screen.getByRole("banner")).toHaveTextContent(
      `Signed in as ${HR_EMAIL}`,
    );
  });

  it("marks the current page in the sidebar navigation", async () => {
    await renderSignedIn();

    const nav = screen.getByRole("navigation", { name: "Main" });
    const link = within(nav).getByRole("link", { name: "Dashboard" });
    expect(link).toHaveAttribute("aria-current", "page");
    // "/" is matched exactly, so Dashboard is not also marked on other pages.
    expect(
      within(nav).getByRole("link", { name: "Employees" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("opens and closes the sidebar with the small-screen menu button", async () => {
    setScreenSize("small");
    const user = await renderSignedIn();
    const menu = screen.getByRole("button", { name: "Menu" });
    const sidebar = document.getElementById("app-sidebar");
    expect(menu).toHaveAttribute("aria-expanded", "false");
    expect(sidebar).not.toHaveClass("show");

    await user.click(menu);
    expect(menu).toHaveAttribute("aria-expanded", "true");
    await waitFor(() =>
      expect(document.getElementById("app-sidebar")).toHaveClass("show"),
    );

    await user.click(screen.getByRole("button", { name: "Close navigation" }));
    await waitFor(() => expect(menu).toHaveAttribute("aria-expanded", "false"));
  });

  it("signs out from the header and lands on the sign-in page with a notice", async () => {
    const user = await renderSignedIn();

    await user.click(screen.getByRole("button", { name: "Sign out" }));

    expect(await screen.findByText("You have signed out.")).toBeInTheDocument();
    expect(currentLocation()).toBe("/sign-in");
  });
});
