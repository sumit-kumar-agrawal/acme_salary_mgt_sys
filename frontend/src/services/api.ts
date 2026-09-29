// Rails API integration: the only place that calls fetch (.claude/rules/frontend/api-integration.md).
// Paths are relative to the base path, e.g. apiRequest("/session") → /api/v1/session (same-site, ADR 004).

/** Base path from configuration (same-site only, ADR 004); a trailing slash is ignored. */
function apiBasePath(): string {
  return (import.meta.env.VITE_API_BASE_URL || "/api/v1").replace(/\/+$/, "");
}

// ---- Response shapes (docs/api-specification.md §2) ----

export interface DataEnvelope<T> {
  data: T;
}

export interface PaginationMeta {
  page: number;
  per_page: number;
  total_count: number;
  total_pages: number;
}

export interface Paginated<T, Meta extends PaginationMeta = PaginationMeta> {
  data: T[];
  meta: Meta;
}

/** Field (or parameter) name → messages; present for validation_failed and bad_request. */
export type ErrorDetails = Record<string, string[]>;

// ---- Errors ----

/**
 * A failed API call. `code` is the API's error code (§10), or `network_error` / `unexpected_response`
 * from the client. The message is the API's generic message or fixed text, never request data.
 */
export class ApiError extends Error {
  status: number;
  code: string;
  details?: ErrorDetails;

  constructor(
    message: string,
    status: number,
    code: string,
    details?: ErrorDetails,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** A message safe to show: the API's message for 4xx, generic text otherwise. */
export function userMessage(error: unknown): string {
  const generic = "Something went wrong. Please try again.";
  if (!isApiError(error) || error.status >= 500) return generic;
  return error.message || generic;
}

// ---- Session hooks (in memory only; set by AuthProvider) ----

let csrfToken: string | null = null;
let onUnauthorized: (() => void) | null = null;
let refreshCsrfToken: (() => Promise<void>) | null = null;

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

export function getCsrfToken(): string | null {
  return csrfToken;
}

/** Called on `401 unauthenticated` (session missing or expired), not on a failed sign-in. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

/** Fetches a fresh CSRF token; used once to retry a write rejected with `invalid_csrf_token`. */
export function setCsrfRefresher(
  refresher: (() => Promise<void>) | null,
): void {
  refreshCsrfToken = refresher;
}

// ---- Requests ----

export type QueryParams = Record<
  string,
  string | number | boolean | null | undefined
>;

export interface ApiRequestOptions extends RequestInit {
  /** Query string values; null, undefined, and "" are left out. */
  query?: QueryParams;
}

const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

/** Absolute URL for a path (fetch in tests needs one; in the browser it is the same origin). */
export function buildUrl(path: string, query: QueryParams = {}): URL {
  const url = new URL(`${apiBasePath()}${path}`, window.location.origin);
  for (const [key, value] of Object.entries(query)) {
    if (value !== null && value !== undefined && value !== "")
      url.searchParams.set(key, String(value));
  }
  return url;
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  try {
    return await send<T>(path, options);
  } catch (error) {
    // Rails rejects a stale CSRF token before running the action, so refreshing and retrying once is safe.
    const method = (options.method ?? "GET").toUpperCase();
    const staleToken =
      isApiError(error) &&
      error.code === "invalid_csrf_token" &&
      WRITE_METHODS.has(method);
    if (!staleToken || !refreshCsrfToken) throw error;

    await refreshCsrfToken();
    return send<T>(path, options);
  }
}

async function send<T>(
  path: string,
  { query, headers, ...init }: ApiRequestOptions,
): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const requestHeaders = new Headers(headers);
  requestHeaders.set("Accept", "application/json");
  if (init.body !== undefined)
    requestHeaders.set("Content-Type", "application/json");
  if (WRITE_METHODS.has(method) && csrfToken)
    requestHeaders.set("X-CSRF-Token", csrfToken);

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      ...init,
      method,
      headers: requestHeaders,
      credentials: "same-origin",
    });
  } catch (error) {
    // A cancelled request is not a network failure (check the signal and name: DOMException differs by realm).
    if (
      init.signal?.aborted ||
      (error instanceof Error && error.name === "AbortError")
    )
      throw error;
    throw new ApiError(
      "Could not reach the server. Check your connection and try again.",
      0,
      "network_error",
    );
  }

  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get("content-type") ?? "";
  const body: unknown = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : null;

  if (response.ok) {
    if (body === null) throw unexpectedResponse(response.status);
    return body as T;
  }

  const apiError = readErrorEnvelope(body);
  if (!apiError) throw unexpectedResponse(response.status);

  if (response.status === 401 && apiError.code === "unauthenticated")
    onUnauthorized?.();
  throw new ApiError(
    apiError.message,
    response.status,
    apiError.code,
    apiError.details,
  );
}

function unexpectedResponse(status: number): ApiError {
  return new ApiError(
    "The server returned an unexpected response. Please try again.",
    status,
    "unexpected_response",
  );
}

/** Reads `{ error: { code, message, details? } }` (§2.2); null if the body is anything else. */
function readErrorEnvelope(
  body: unknown,
): { code: string; message: string; details?: ErrorDetails } | null {
  if (typeof body !== "object" || body === null || !("error" in body))
    return null;
  const { error } = body;
  if (typeof error !== "object" || error === null) return null;
  if (!("code" in error) || typeof error.code !== "string") return null;
  if (!("message" in error) || typeof error.message !== "string") return null;
  const details =
    "details" in error ? (error.details as ErrorDetails) : undefined;
  return { code: error.code, message: error.message, details };
}
