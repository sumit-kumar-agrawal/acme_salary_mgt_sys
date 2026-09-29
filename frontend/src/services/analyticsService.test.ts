import { describe, expect, it } from "vitest";
import { analyticsService } from "@/services/analyticsService";
import {
  BREAKDOWN,
  DISTRIBUTION,
  SUMMARY,
  mockAnalytics,
} from "@/test/fixtures/analytics";

describe("analyticsService", () => {
  it("sends the filters to each endpoint and unwraps `data`", async () => {
    const api = mockAnalytics();
    const filters = { as_of: "2026-01-31", country_id: "5" };

    await expect(analyticsService.summary(filters)).resolves.toEqual(SUMMARY);
    await expect(analyticsService.distribution(filters)).resolves.toEqual(
      DISTRIBUTION,
    );
    await expect(
      analyticsService.breakdown(filters, "country"),
    ).resolves.toEqual(BREAKDOWN);

    expect(api.lastQuery("summary")).toEqual(filters);
    expect(api.lastQuery("distribution")).toEqual(filters);
    expect(api.lastQuery("breakdown")).toEqual({ ...filters, by: "country" });
  });

  it("leaves out filters that are not set", async () => {
    const api = mockAnalytics();

    await analyticsService.summary({ country_id: undefined });

    expect(api.lastQuery("summary")).toEqual({});
  });
});
