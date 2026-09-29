import { QueryClient } from "@tanstack/react-query";
import { isApiError } from "@/services/api";

// TanStack Query defaults (FRONTEND_PLAN.md Q11, FD13).

const MAX_QUERY_RETRIES = 1;

/** Retry a failed query at most once, and never for a 4xx answer (it will not change on retry). */
export function shouldRetryQuery(
  failureCount: number,
  error: unknown,
): boolean {
  // 4xx answers are final; retrying them does not help.
  if (isApiError(error) && error.status >= 400 && error.status < 500)
    return false;
  return failureCount < MAX_QUERY_RETRIES;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetryQuery,
        // Each refetch is a signed-in request that refreshes the session idle timer (API spec §13),
        // so data is not refetched just because the window regains focus.
        refetchOnWindowFocus: false,
        staleTime: 30_000,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
