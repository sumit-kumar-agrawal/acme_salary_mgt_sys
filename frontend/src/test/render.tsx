import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, useLocation } from "react-router";
import AuthProvider from "@/components/auth/AuthProvider";
import { createQueryClient } from "@/services/queryClient";

/** The app's query client with retry delays removed, so retry paths run instantly in tests. */
export function createTestQueryClient(): QueryClient {
  const client = createQueryClient();
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
type InitialRoute =
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
