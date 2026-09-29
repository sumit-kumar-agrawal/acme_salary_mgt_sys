import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { analyticsService } from "@/services/analyticsService";
import type { BreakdownDimension } from "@/services/analytics.types";
import type { QueryParams } from "@/services/api";

// Analytics queries (FRONTEND_PLAN.md V6). Keys start with "analytics", so a salary change or correction
// marks them stale (U4). Each keeps its previous result on screen while new filters load.

export const analyticsKeys = {
  summary: (filters: QueryParams) => ["analytics", "summary", filters] as const,
  distribution: (filters: QueryParams) =>
    ["analytics", "distribution", filters] as const,
  breakdown: (filters: QueryParams, by: BreakdownDimension) =>
    ["analytics", "breakdown", filters, by] as const,
};

export function useAnalyticsSummary(filters: QueryParams) {
  return useQuery({
    queryKey: analyticsKeys.summary(filters),
    queryFn: () => analyticsService.summary(filters),
    placeholderData: keepPreviousData,
  });
}

export function useAnalyticsDistribution(filters: QueryParams) {
  return useQuery({
    queryKey: analyticsKeys.distribution(filters),
    queryFn: () => analyticsService.distribution(filters),
    placeholderData: keepPreviousData,
  });
}

export function useAnalyticsBreakdown(
  filters: QueryParams,
  by: BreakdownDimension,
) {
  return useQuery({
    queryKey: analyticsKeys.breakdown(filters, by),
    queryFn: () => analyticsService.breakdown(filters, by),
    placeholderData: keepPreviousData,
  });
}
