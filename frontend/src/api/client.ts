import { getCsrfToken } from "@/api/csrf";
import { ApiError } from "@/api/errors";
import type { ErrorEnvelope } from "@/api/types";

// The only place in the app that calls fetch (.claude/rules/frontend/api-integration.md, FRONTEND_PLAN.md Q10).

export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
export type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue>;

export interface RequestOptions {
  query?: QueryParams;
  body?: unknown;
  signal?: AbortSignal;
}

const STATE_CHANGING: ReadonlySet<HttpMethod> = new Set([
  "POST",
  "PATCH",
  "PUT",
  "DELETE",
]);

const NETWORK_ERROR_MESSAGE =
  "Could not reach the server. Check your connection and try again.";
const UNEXPECTED_RESPONSE_MESSAGE =
  "The server returned an unexpected response. Please try again.";

/** Base path from configuration; same-site only (ADR 004). A trailing slash is ignored. */
export function apiBasePath(): string {
  return (import.meta.env.VITE_API_BASE_URL || "/api/v1").replace(/\/+$/, "");
}

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

/**
 * Registers what happens when the session is missing or expired (`401 unauthenticated`).
 * The AuthProvider (F3.1) sets this. A failed sign-in (`401 invalid_credentials`) does not trigger it.
 */
export function setUnauthorizedHandler(
  handler: UnauthorizedHandler | null,
): void {
  unauthorizedHandler = handler;
}

export function buildUrl(path: string, query?: QueryParams): URL {
  // Resolved against the page origin: same origin in the browser, and an absolute URL for fetch in tests.
  const url = new URL(`${apiBasePath()}${path}`, window.location.origin);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === null || value === undefined || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return url;
}

function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
  if (typeof value !== "object" || value === null || !("error" in value))
    return false;
  const { error } = value;
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    "message" in error &&
    typeof error.message === "string"
  );
}

async function readJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get("Content-Type") ?? "";
  if (!contentType.includes("application/json")) return undefined;
  try {
    return (await response.json()) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * Sends a JSON request to the API and returns the parsed body.
 * - Cookie session (`credentials: "same-origin"`); `X-CSRF-Token` on state-changing methods.
 * - `204` → `undefined`.
 * - Failures throw `ApiError` with the envelope's code, message, and details, or a client code.
 */
export async function apiRequest<T>(
  method: HttpMethod,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const headers = new Headers({ Accept: "application/json" });
  if (options.body !== undefined)
    headers.set("Content-Type", "application/json");
  if (STATE_CHANGING.has(method)) {
    const token = getCsrfToken();
    if (token) headers.set("X-CSRF-Token", token);
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      credentials: "same-origin",
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (error) {
    // A cancelled request (e.g. TanStack Query cancelling a query) is not a network failure. Check the signal
    // and the error name, not `instanceof DOMException`: the class differs between realms (jsdom vs Node).
    const aborted =
      options.signal?.aborted === true ||
      (error instanceof Error && error.name === "AbortError");
    if (aborted) throw error;
    throw new ApiError(0, "network_error", NETWORK_ERROR_MESSAGE);
  }

  if (response.status === 204) return undefined as T;

  const body = await readJson(response);

  if (response.ok) {
    if (body === undefined)
      throw new ApiError(
        response.status,
        "unexpected_response",
        UNEXPECTED_RESPONSE_MESSAGE,
      );
    return body as T;
  }

  if (!isErrorEnvelope(body)) {
    throw new ApiError(
      response.status,
      "unexpected_response",
      UNEXPECTED_RESPONSE_MESSAGE,
    );
  }

  const { code, message, details } = body.error;
  const error = new ApiError(response.status, code, message, details);
  if (response.status === 401 && code === "unauthenticated")
    unauthorizedHandler?.();
  throw error;
}
