import {
  apiRequest,
  type DataEnvelope,
  type QueryParams,
} from "@/services/api";
import type {
  AnalyticsBreakdown,
  AnalyticsDistribution,
  AnalyticsSummary,
  BreakdownDimension,
} from "@/services/analytics.types";

// Analytics endpoints (API spec §8): read-only aggregates, never individual salaries. The filters are
// as_of, country_id, department_id, and employment_status (§8.1).

export const analyticsService = {
  async summary(filters: QueryParams): Promise<AnalyticsSummary> {
    const { data } = await apiRequest<DataEnvelope<AnalyticsSummary>>(
      "/analytics/summary",
      { query: filters },
    );
    return data;
  },

  async distribution(filters: QueryParams): Promise<AnalyticsDistribution> {
    const { data } = await apiRequest<DataEnvelope<AnalyticsDistribution>>(
      "/analytics/distribution",
      { query: filters },
    );
    return data;
  },

  async breakdown(
    filters: QueryParams,
    by: BreakdownDimension,
  ): Promise<AnalyticsBreakdown> {
    const { data } = await apiRequest<DataEnvelope<AnalyticsBreakdown>>(
      "/analytics/breakdown",
      { query: { ...filters, by } },
    );
    return data;
  },
};
