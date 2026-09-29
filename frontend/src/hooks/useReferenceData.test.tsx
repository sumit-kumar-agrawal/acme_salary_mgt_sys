import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import {
  useCountries,
  useCurrencies,
  useDepartments,
} from "@/hooks/useReferenceData";
import { COUNTRIES, mockReferenceData } from "@/test/fixtures/referenceData";
import { createTestQueryClient } from "@/test/render";

describe("useReferenceData (S6)", () => {
  it("loads each list once and shares it between consumers", async () => {
    const requests = mockReferenceData();
    const client = createTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const first = renderHook(() => useCountries(), { wrapper });
    await waitFor(() => expect(first.result.current.data).toEqual(COUNTRIES));
    const second = renderHook(() => useCountries(), { wrapper });

    expect(second.result.current.data).toEqual(COUNTRIES);
    expect(requests.countries).toBe(1);
  });

  it("exposes departments and currencies the same way", async () => {
    mockReferenceData();
    const client = createTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(
      () => ({ departments: useDepartments(), currencies: useCurrencies() }),
      { wrapper },
    );

    await waitFor(() =>
      expect(
        result.current.departments.isSuccess &&
          result.current.currencies.isSuccess,
      ).toBe(true),
    );
    expect(
      result.current.currencies.data?.map((currency) => currency.code),
    ).toEqual(["INR", "JPY", "KWD"]);
  });
});
