import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import { getCsrfToken, setCsrfToken } from "@/services/api";
import { authService } from "@/services/authService";
import {
  HR_EMAIL,
  HR_PASSWORD,
  mockSessionBackend,
} from "@/test/fixtures/sessionBackend";
import { server } from "@/test/server";

afterEach(() => setCsrfToken(null));

describe("authService (R4 token lifecycle)", () => {
  it("getSession returns the state and stores its CSRF token", async () => {
    mockSessionBackend();

    const session = await authService.getSession();

    expect(session).toEqual({
      authenticated: false,
      user: null,
      csrf_token: "token-1",
    });
    expect(getCsrfToken()).toBe("token-1");
  });

  it("signIn sends unwrapped credentials with the current token and replaces the token", async () => {
    const backend = mockSessionBackend();
    await authService.getSession();

    const session = await authService.signIn({
      email: HR_EMAIL,
      password: HR_PASSWORD,
    });

    const post = backend.state.requests.find(
      (request) => request.method === "POST",
    );
    expect(post).toEqual({
      method: "POST",
      token: "token-1",
      body: { email: HR_EMAIL, password: HR_PASSWORD },
    });
    expect(session.user).toEqual({ email: HR_EMAIL });
    expect(getCsrfToken()).toBe("token-2");
  });

  it("signOut sends the token, then clears it", async () => {
    const backend = mockSessionBackend({ signedIn: true });
    await authService.getSession();

    await authService.signOut();

    expect(backend.state.requests.at(-1)).toEqual({
      method: "DELETE",
      token: "token-1",
    });
    expect(getCsrfToken()).toBeNull();
  });

  it("signOut clears the token even when the request fails", async () => {
    setCsrfToken("token-9");
    server.use(http.delete("*/api/v1/session", () => HttpResponse.error()));

    await expect(authService.signOut()).rejects.toMatchObject({
      code: "network_error",
    });
    expect(getCsrfToken()).toBeNull();
  });
});
