import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import { apiRequest, getCsrfToken, setCsrfToken } from "@/services/api";
import App from "@/App";
import {
  HR_EMAIL,
  HR_PASSWORD,
  mockSessionBackend,
} from "@/test/fixtures/sessionBackend";
import { renderWithProviders } from "@/test/render";
import { server } from "@/test/server";

// Session flows through the whole app shell (FRONTEND_PLAN.md R2–R6): startup, sign-in, sign-out, expiry.

afterEach(() => setCsrfToken(null));

async function signInThroughForm() {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText("Email"), HR_EMAIL);
  await user.type(screen.getByLabelText("Password"), HR_PASSWORD);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
  return user;
}

describe("App startup (R3)", () => {
  it("shows a loading state, then the sign-in page when signed out", async () => {
    mockSessionBackend();
    renderWithProviders(<App />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
    expect(
      await screen.findByRole("heading", { name: "Sign in" }),
    ).toBeInTheDocument();
  });

  it("opens the app directly when the session is already signed in", async () => {
    mockSessionBackend({ signedIn: true });
    renderWithProviders(<App />);

    expect(
      await screen.findByText(`Signed in as ${HR_EMAIL}`),
    ).toBeInTheDocument();
  });

  it("shows a retryable error, not the sign-in page, when the API is unreachable", async () => {
    server.use(http.get("*/api/v1/session", () => HttpResponse.error()));
    renderWithProviders(<App />);

    expect(
      await screen.findByRole("heading", {
        name: "The application could not start",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Sign in" }),
    ).not.toBeInTheDocument();

    mockSessionBackend();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(
      await screen.findByRole("heading", { name: "Sign in" }),
    ).toBeInTheDocument();
  });
});

describe("Signing in and out (R4, R6)", () => {
  it("signs in and replaces the CSRF token with the one returned at sign-in", async () => {
    mockSessionBackend();
    renderWithProviders(<App />);

    await signInThroughForm();

    expect(
      await screen.findByText(`Signed in as ${HR_EMAIL}`),
    ).toBeInTheDocument();
    expect(getCsrfToken()).toBe("token-2");
  });

  it("signs out with the current token, clears cached data, and fetches a fresh token", async () => {
    const backend = mockSessionBackend({ signedIn: true });
    const { queryClient } = renderWithProviders(<App />);
    await screen.findByText(`Signed in as ${HR_EMAIL}`);
    queryClient.setQueryData(["employees"], {
      data: [{ first_name: "Synthetic" }],
    });

    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(await screen.findByText("You have signed out.")).toBeInTheDocument();
    expect(backend.state.requests.find((r) => r.method === "DELETE")).toEqual({
      method: "DELETE",
      token: "token-1",
    });
    expect(queryClient.getQueryData(["employees"])).toBeUndefined();
    await waitFor(() => expect(getCsrfToken()).toBe("token-2"));

    await signInThroughForm();
    expect(
      await screen.findByText(`Signed in as ${HR_EMAIL}`),
    ).toBeInTheDocument();
  });

  it("treats 401 unauthenticated from any request as an expired session", async () => {
    const backend = mockSessionBackend({ signedIn: true });
    const { queryClient } = renderWithProviders(<App />);
    await screen.findByText(`Signed in as ${HR_EMAIL}`);
    queryClient.setQueryData(["employees"], {
      data: [{ first_name: "Synthetic" }],
    });
    server.use(
      http.get("*/api/v1/employees", () =>
        HttpResponse.json(
          { error: { code: "unauthenticated", message: "Please sign in." } },
          { status: 401 },
        ),
      ),
    );
    backend.expire();

    await expect(apiRequest("/employees")).rejects.toMatchObject({
      code: "unauthenticated",
    });

    expect(
      await screen.findByText(
        "Your session has expired. Please sign in again.",
      ),
    ).toBeInTheDocument();
    expect(queryClient.getQueryData(["employees"])).toBeUndefined();
  });

  it("recovers from a stale CSRF token by refreshing it and retrying (R5)", async () => {
    const backend = mockSessionBackend();
    renderWithProviders(<App />);
    await screen.findByRole("heading", { name: "Sign in" });
    setCsrfToken("stale-token");

    await signInThroughForm();

    expect(
      await screen.findByText(`Signed in as ${HR_EMAIL}`),
    ).toBeInTheDocument();
    const posts = backend.state.requests
      .filter((r) => r.method === "POST")
      .map((r) => r.token);
    expect(posts).toEqual(["stale-token", "token-2"]);
  });
});
