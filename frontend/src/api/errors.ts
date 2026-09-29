import type { ApiErrorCode, ErrorDetails } from "@/api/types";

/**
 * A failed API call. `code` comes from the error envelope (API spec §10) or is a client code
 * (`network_error`, `unexpected_response`). Messages are the API's generic messages or fixed client text;
 * they never contain request or response payloads (.claude/rules/frontend/security.md).
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode | (string & {});
  readonly details: ErrorDetails | undefined;

  constructor(
    status: number,
    code: ApiErrorCode | (string & {}),
    message: string,
    details?: ErrorDetails,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** 4xx responses are the client's fault or a final answer; retrying them does not help. */
  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
