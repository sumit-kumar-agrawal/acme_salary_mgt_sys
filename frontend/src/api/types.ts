// Shared response shapes from docs/api-specification.md v2.1 (§2.1–§2.3, §10).
// Resource types are added by the feature modules that use them.

/** Error codes the API returns (§10), plus the two the client creates itself. */
export type ApiErrorCode =
  | "bad_request"
  | "unauthenticated"
  | "invalid_credentials"
  | "not_found"
  | "validation_failed"
  | "salary_record_not_editable"
  | "export_too_large"
  | "invalid_csrf_token"
  | "rate_limited"
  | "internal_error"
  // Client-side codes: the request never reached the API, or the response was not the JSON envelope.
  | "network_error"
  | "unexpected_response";

/** Field (or parameter) name → messages. Present for validation_failed and bad_request (§2.2). */
export type ErrorDetails = Record<string, string[]>;

/** §2.2 error envelope. */
export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: ErrorDetails;
  };
}

/** §2.1 single resource. */
export interface DataEnvelope<T> {
  data: T;
}

/** §2.3 pagination meta. */
export interface PaginationMeta {
  page: number;
  per_page: number;
  total_count: number;
  total_pages: number;
}

/** §2.3 paginated collection. Some endpoints extend `meta` (e.g. the salary report adds as_of and filters). */
export interface Paginated<T, Meta extends PaginationMeta = PaginationMeta> {
  data: T[];
  meta: Meta;
}
