import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import { setCsrfToken } from "@/services/api";
import App from "@/App";
import { HR_EMAIL, mockSessionBackend } from "@/test/fixtures/sessionBackend";
import { renderWithProviders } from "@/test/render";
import { server } from "@/test/server";

// Sign-in form behaviour (FRONTEND_PLAN.md R8). Rendered through App so the real AuthProvider is used.

afterEach(() => setCsrfToken(null));

async function renderSignIn(
  options?: Parameters<typeof mockSessionBackend>[0],
) {
  const backend = mockSessionBackend(options);
  renderWithProviders(<App />);
  await screen.findByRole("heading", { name: "Sign in" });
  return { backend, user: userEvent.setup() };
}

describe("SignInPage", () => {
  it("has labelled fields with sign-in autocomplete hints", async () => {
    await renderSignIn();

    expect(screen.getByLabelText("Email")).toHaveAttribute(
      "autocomplete",
      "username",
    );
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "type",
      "password",
    );
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
  });

  it("checks required fields and email format without calling the API", async () => {
    const { backend, user } = await renderSignIn();

    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByText("Enter your email address.")).toBeInTheDocument();
    expect(screen.getByText("Enter your password.")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveAttribute(
      "aria-invalid",
      "true",
    );

    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(
      screen.getByText("Enter a valid email address."),
    ).toBeInTheDocument();

    expect(
      backend.state.requests.some((request) => request.method === "POST"),
    ).toBe(false);
  });

  it("shows the API's generic message for wrong credentials and clears the password", async () => {
    const { user } = await renderSignIn();

    await user.type(screen.getByLabelText("Email"), HR_EMAIL);
    await user.type(screen.getByLabelText("Password"), "wrong-password-123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid email or password.",
    );
    expect(screen.getByLabelText("Password")).toHaveValue("");
    expect(screen.getByLabelText("Email")).toHaveValue(HR_EMAIL);
  });

  it("explains rate limiting", async () => {
    const { user } = await renderSignIn({
      signInResponse: () =>
        HttpResponse.json(
          {
            error: {
              code: "rate_limited",
              message: "Too many sign-in attempts. Try again later.",
            },
          },
          { status: 429 },
        ),
    });

    await user.type(screen.getByLabelText("Email"), HR_EMAIL);
    await user.type(screen.getByLabelText("Password"), "any-password-1");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Too many sign-in attempts. Wait a minute and try again.",
    );
  });

  it("shows a connection message when the API cannot be reached", async () => {
    const { user } = await renderSignIn({
      signInResponse: () => HttpResponse.error(),
    });

    await user.type(screen.getByLabelText("Email"), HR_EMAIL);
    await user.type(screen.getByLabelText("Password"), "any-password-1");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not reach the server.",
    );
  });

  it("disables the button while signing in", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { user } = await renderSignIn();
    // Hold the POST open until the assertion has run (server.use handlers take precedence).
    server.use(
      http.post("*/api/v1/session", async () => {
        await gate;
        return HttpResponse.json(
          {
            error: {
              code: "invalid_credentials",
              message: "Invalid email or password.",
            },
          },
          { status: 401 },
        );
      }),
    );

    await user.type(screen.getByLabelText("Email"), HR_EMAIL);
    await user.type(screen.getByLabelText("Password"), "any-password-1");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(screen.getByRole("button", { name: "Signing in…" })).toBeDisabled();
    release();
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});
