import { http, HttpResponse } from "msw";
import { server } from "@/test/server";

// A small stateful fake of the session endpoints (API spec §4) for component tests. Like Rails, it issues a
// new CSRF token on every session response and rejects writes whose token does not match the current one.

export const HR_EMAIL = "hr@example.test";
export const HR_PASSWORD = "correct-horse-battery";

interface Options {
  signedIn?: boolean;
  /** Overrides POST /session (e.g. a 429 or a network error). */
  signInResponse?: () => Response;
}

function envelope(code: string, message: string) {
  return { error: { code, message } };
}

export function mockSessionBackend({
  signedIn = false,
  signInResponse,
}: Options = {}) {
  const state = {
    signedIn,
    tokenCounter: 0,
    currentToken: "",
    requests: [] as { method: string; token: string | null; body?: unknown }[],
  };

  const issueToken = () => {
    state.tokenCounter += 1;
    state.currentToken = `token-${state.tokenCounter}`;
    return state.currentToken;
  };
  const sessionBody = () => ({
    data: {
      authenticated: state.signedIn,
      user: state.signedIn ? { email: HR_EMAIL } : null,
      csrf_token: issueToken(),
    },
  });
  const tokenValid = (request: Request) =>
    request.headers.get("X-CSRF-Token") === state.currentToken;

  server.use(
    http.get("*/api/v1/session", ({ request }) => {
      state.requests.push({
        method: "GET",
        token: request.headers.get("X-CSRF-Token"),
      });
      return HttpResponse.json(sessionBody());
    }),
    http.post("*/api/v1/session", async ({ request }) => {
      const body = (await request.json()) as {
        email?: string;
        password?: string;
      };
      state.requests.push({
        method: "POST",
        token: request.headers.get("X-CSRF-Token"),
        body,
      });
      if (signInResponse) return signInResponse();
      if (!tokenValid(request)) {
        return HttpResponse.json(
          envelope("invalid_csrf_token", "Missing or invalid CSRF token."),
          { status: 422 },
        );
      }
      if (body.email !== HR_EMAIL || body.password !== HR_PASSWORD) {
        return HttpResponse.json(
          envelope("invalid_credentials", "Invalid email or password."),
          { status: 401 },
        );
      }
      state.signedIn = true;
      return HttpResponse.json(sessionBody());
    }),
    http.delete("*/api/v1/session", ({ request }) => {
      state.requests.push({
        method: "DELETE",
        token: request.headers.get("X-CSRF-Token"),
      });
      if (!state.signedIn) {
        return HttpResponse.json(
          envelope("unauthenticated", "Please sign in."),
          { status: 401 },
        );
      }
      if (!tokenValid(request)) {
        return HttpResponse.json(
          envelope("invalid_csrf_token", "Missing or invalid CSRF token."),
          { status: 422 },
        );
      }
      state.signedIn = false;
      return new HttpResponse(null, { status: 204 });
    }),
  );

  return {
    state,
    /** Simulates the server-side session expiring (30 minutes idle or 8 hours). */
    expire() {
      state.signedIn = false;
    },
  };
}
