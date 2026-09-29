import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, useLocation } from "react-router";
import AuthProvider from "@/components/auth/AuthProvider";
import { createQueryClient } from "@/services/queryClient";

const activeClients = new Set<QueryClient>();

/**
 * Waits until every test query client has no request in flight, then clears it (called after each test).
 * Without this, a request started at the end of one test (e.g. the fresh-token fetch after sign-out)
 * could land on the next test's mock handlers and make token-counting assertions flaky.
 */
export async function settleQueryClients(): Promise<void> {
  for (const client of activeClients) {
    await waitFor(
      () => {
        if (client.isFetching() + client.isMutating() > 0)
          throw new Error("query client still busy");
      },
      { timeout: 3000 },
    );
    client.clear();
  }
  activeClients.clear();
}

/** The app's query client with retry delays removed, so retry paths run instantly in tests. */
export function createTestQueryClient(): QueryClient {
  const client = createQueryClient();
  activeClients.add(client);
  client.setDefaultOptions({
    ...client.getDefaultOptions(),
    queries: { ...client.getDefaultOptions().queries, retryDelay: 0 },
  });
  return client;
}

/** Exposes the router's current path and search for assertions (not user-visible UI). */
function LocationProbe() {
  const location = useLocation();
  return (
    <output
      data-testid="location"
      hidden
    >{`${location.pathname}${location.search}`}</output>
  );
}

/** The current in-memory URL (path + search) of a component rendered with renderWithProviders. */
export function currentLocation(): string {
  return screen.getByTestId("location").textContent ?? "";
}

/** A URL, or a location with history state (e.g. a crafted sign-in return path). */
export type InitialRoute =
  string | { pathname: string; search?: string; state?: unknown };

interface RenderOptions {
  /** Initial URL (default "/"). */
  route?: InitialRoute;
  queryClient?: QueryClient;
}

/** Renders inside the same providers as src/main.tsx, with an in-memory router at `route`. */
export function renderWithProviders(
  ui: ReactElement,
  { route = "/", queryClient = createTestQueryClient() }: RenderOptions = {},
) {
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={[route]}>
            {ui}
            <LocationProbe />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>,
    ),
  };
}

/** Renders with only a query client (components that load data but need no router or session). */
export function renderWithQueryClient(
  ui: ReactElement,
  queryClient = createTestQueryClient(),
) {
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
    ),
  };
}
