import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest, buildUrl, setUnauthorizedHandler } from "@/api/client";
import { setCsrfToken } from "@/api/csrf";
import { ApiError } from "@/api/errors";
import { server } from "@/test/server";

// Synthetic data only. Each test registers the handlers it needs; unhandled requests fail (src/test/setup.ts).

function envelope(
  code: string,
  message: string,
  details?: Record<string, string[]>,
) {
  return { error: { code, message, ...(details ? { details } : {}) } };
}

async function captureError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error("expected the request to fail");
}

afterEach(() => {
  setCsrfToken(null);
  setUnauthorizedHandler(null);
  vi.unstubAllEnvs();
});

describe("apiRequest: success", () => {
  it("GETs JSON from the API base path with the cookie session and drops empty query values", async () => {
    let seen: Request | undefined;
    server.use(
      http.get("*/api/v1/employees", ({ request }) => {
        seen = request;
        return HttpResponse.json({
          data: [{ id: 1 }],
          meta: { page: 2, per_page: 25, total_count: 26, total_pages: 2 },
        });
      }),
    );

    const body = await apiRequest<{ data: { id: number }[] }>(
      "GET",
      "/employees",
      {
        query: {
          page: 2,
          q: "",
          country_id: null,
          department_id: undefined,
          employment_status: "active",
        },
      },
    );

    expect(body.data).toEqual([{ id: 1 }]);
    const url = new URL(seen!.url);
    expect(url.pathname).toBe("/api/v1/employees");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      page: "2",
      employment_status: "active",
    });
    expect(seen!.headers.get("Accept")).toBe("application/json");
    expect(seen!.credentials).toBe("same-origin");
  });

  it("returns undefined for 204 No Content", async () => {
    setCsrfToken("token-1");
    server.use(
      http.delete(
        "*/api/v1/session",
        () => new HttpResponse(null, { status: 204 }),
      ),
    );

    await expect(apiRequest("DELETE", "/session")).resolves.toBeUndefined();
  });

  it("uses VITE_API_BASE_URL when configured, ignoring a trailing slash", () => {
    vi.stubEnv("VITE_API_BASE_URL", "/custom-api/");

    expect(buildUrl("/health").pathname).toBe("/custom-api/health");
  });
});

describe("apiRequest: CSRF token", () => {
  it("sends X-CSRF-Token and a JSON body on writes", async () => {
    setCsrfToken("token-1");
    let seen:
      { token: string | null; type: string | null; body: unknown } | undefined;
    server.use(
      http.post("*/api/v1/employees", async ({ request }) => {
        seen = {
          token: request.headers.get("X-CSRF-Token"),
          type: request.headers.get("Content-Type"),
          body: await request.json(),
        };
        return HttpResponse.json({ data: { id: 7 } }, { status: 201 });
      }),
    );

    await apiRequest("POST", "/employees", {
      body: { employee: { first_name: "Ada" } },
    });

    expect(seen).toEqual({
      token: "token-1",
      type: "application/json",
      body: { employee: { first_name: "Ada" } },
    });
  });

  it("does not send the token on reads", async () => {
    setCsrfToken("token-1");
    let token: string | null = "not checked";
    server.use(
      http.get("*/api/v1/countries", ({ request }) => {
        token = request.headers.get("X-CSRF-Token");
        return HttpResponse.json({ data: [] });
      }),
    );

    await apiRequest("GET", "/countries");

    expect(token).toBeNull();
  });

  it("surfaces invalid_csrf_token so the caller can refresh the token", async () => {
    server.use(
      http.patch("*/api/v1/employees/1", () =>
        HttpResponse.json(
          envelope("invalid_csrf_token", "Missing or invalid CSRF token."),
          { status: 422 },
        ),
      ),
    );

    const error = await captureError(
      apiRequest("PATCH", "/employees/1", { body: { employee: {} } }),
    );

    expect([error.status, error.code]).toEqual([422, "invalid_csrf_token"]);
  });
});

describe("apiRequest: API errors", () => {
  it("turns 401 unauthenticated into an ApiError and calls the unauthorized handler", async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    server.use(
      http.get("*/api/v1/employees", () =>
        HttpResponse.json(envelope("unauthenticated", "Please sign in."), {
          status: 401,
        }),
      ),
    );

    const error = await captureError(apiRequest("GET", "/employees"));

    expect([error.status, error.code, error.message]).toEqual([
      401,
      "unauthenticated",
      "Please sign in.",
    ]);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("does not treat a failed sign-in (401 invalid_credentials) as an expired session", async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    server.use(
      http.post("*/api/v1/session", () =>
        HttpResponse.json(
          envelope("invalid_credentials", "Invalid email or password."),
          { status: 401 },
        ),
      ),
    );

    const error = await captureError(
      apiRequest("POST", "/session", {
        body: { email: "x@example.test", password: "x" },
      }),
    );

    expect(error.code).toBe("invalid_credentials");
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("keeps 422 validation details keyed by request field", async () => {
    const details = {
      employee_number: ["has already been taken"],
      "initial_salary.amount": ["must be greater than 0"],
    };
    server.use(
      http.post("*/api/v1/employees", () =>
        HttpResponse.json(
          envelope(
            "validation_failed",
            "Please correct the highlighted fields.",
            details,
          ),
          { status: 422 },
        ),
      ),
    );

    const error = await captureError(
      apiRequest("POST", "/employees", { body: { employee: {} } }),
    );

    expect([error.status, error.code]).toEqual([422, "validation_failed"]);
    expect(error.details).toEqual(details);
    expect(error.isClientError).toBe(true);
  });

  it("reports rate limiting (429) and bad requests (400) by code", async () => {
    server.use(
      http.post("*/api/v1/session", () =>
        HttpResponse.json(
          envelope(
            "rate_limited",
            "Too many sign-in attempts. Try again later.",
          ),
          { status: 429 },
        ),
      ),
      http.get("*/api/v1/employees", () =>
        HttpResponse.json(
          envelope("bad_request", "The request is malformed.", {
            sort: ["must be one of: …"],
          }),
          {
            status: 400,
          },
        ),
      ),
    );

    const limited = await captureError(
      apiRequest("POST", "/session", { body: {} }),
    );
    const bad = await captureError(
      apiRequest("GET", "/employees", { query: { sort: "salary" } }),
    );

    expect([limited.status, limited.code]).toEqual([429, "rate_limited"]);
    expect([bad.status, bad.code, Object.keys(bad.details ?? {})]).toEqual([
      400,
      "bad_request",
      ["sort"],
    ]);
  });
});

describe("apiRequest: transport failures", () => {
  it("maps a network failure to network_error with status 0", async () => {
    server.use(http.get("*/api/v1/health", () => HttpResponse.error()));

    const error = await captureError(apiRequest("GET", "/health"));

    expect([error.status, error.code]).toEqual([0, "network_error"]);
  });

  it("maps a non-JSON error page (e.g. a proxy 502) to unexpected_response", async () => {
    server.use(
      http.get("*/api/v1/employees", () =>
        HttpResponse.html("<h1>Bad Gateway</h1>", { status: 502 }),
      ),
    );

    const error = await captureError(apiRequest("GET", "/employees"));

    expect([error.status, error.code]).toEqual([502, "unexpected_response"]);
    expect(error.isClientError).toBe(false);
  });

  it("rejects a successful response that is not JSON", async () => {
    server.use(
      http.get("*/api/v1/employees", () =>
        HttpResponse.text("ok", { status: 200 }),
      ),
    );

    const error = await captureError(apiRequest("GET", "/employees"));

    expect(error.code).toBe("unexpected_response");
  });
});

describe("apiRequest: cancellation", () => {
  it("re-throws an aborted request unchanged instead of reporting a network error", async () => {
    server.use(
      http.get("*/api/v1/employees", () => HttpResponse.json({ data: [] })),
    );
    const controller = new AbortController();
    controller.abort();

    await expect(
      apiRequest("GET", "/employees", { signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("apiRequest: privacy", () => {
  it("never puts submitted values into the error it throws", async () => {
    const secret = "correct-horse-battery-staple";
    const salary = "123456.78";
    server.use(
      http.post("*/api/v1/session", () =>
        HttpResponse.json(
          envelope("invalid_credentials", "Invalid email or password."),
          { status: 401 },
        ),
      ),
      http.post("*/api/v1/employees/1/salary_records", () =>
        HttpResponse.error(),
      ),
    );

    const errors = [
      await captureError(
        apiRequest("POST", "/session", {
          body: { email: "hr@example.test", password: secret },
        }),
      ),
      await captureError(
        apiRequest("POST", "/employees/1/salary_records", {
          body: { salary_record: { amount: salary } },
        }),
      ),
    ];

    for (const error of errors) {
      const text = [
        error.message,
        String(error),
        JSON.stringify(error),
        error.stack ?? "",
      ].join("\n");
      expect(text).not.toContain(secret);
      expect(text).not.toContain(salary);
      expect(text).not.toContain("hr@example.test");
    }
  });
});
