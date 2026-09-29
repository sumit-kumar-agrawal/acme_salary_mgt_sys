import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { apiRequest } from "@/services/api";
import { ApiError } from "@/services/api";
import { createQueryClient, shouldRetryQuery } from "@/services/queryClient";
import { server } from "@/test/server";

// Q11: at most one retry, none for 4xx; no refetch on window focus; mutations never retry.

function countingHandler(status: number) {
  const calls = { count: 0 };
  server.use(
    http.get("*/api/v1/probe", () => {
      calls.count += 1;
      return HttpResponse.json(
        { error: { code: "x", message: "Failed." } },
        { status },
      );
    }),
  );
  return calls;
}

function renderProbeQuery() {
  const client = createQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  // retryDelay 0 keeps the test fast; the retry decision still comes from the client defaults.
  return renderHook(
    () =>
      useQuery({
        queryKey: ["probe"],
        queryFn: () => apiRequest("/probe"),
        retryDelay: 0,
      }),
    { wrapper },
  );
}

describe("shouldRetryQuery", () => {
  it("never retries 4xx answers", () => {
    for (const status of [400, 401, 404, 422, 429]) {
      expect(shouldRetryQuery(0, new ApiError("Failed.", status, "x"))).toBe(
        false,
      );
    }
  });

  it("retries server and network failures once", () => {
    for (const error of [
      new ApiError("Failed.", 500, "internal_error"),
      new ApiError("Failed.", 0, "network_error"),
    ]) {
      expect(shouldRetryQuery(0, error)).toBe(true);
      expect(shouldRetryQuery(1, error)).toBe(false);
    }
  });
});

describe("createQueryClient", () => {
  it("does not retry a 404 query", async () => {
    const calls = countingHandler(404);

    const { result } = renderProbeQuery();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(calls.count).toBe(1);
  });

  it("retries a 500 query exactly once", async () => {
    const calls = countingHandler(500);

    const { result } = renderProbeQuery();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(calls.count).toBe(2);
  });

  it("does not refetch on window focus and never retries mutations", () => {
    const defaults = createQueryClient().getDefaultOptions();

    expect(defaults.queries?.refetchOnWindowFocus).toBe(false);
    expect(defaults.mutations?.retry).toBe(false);
  });
});
