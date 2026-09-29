module Api
  module V1
    module Analytics
      # GET /api/v1/analytics/summary: per-currency monthly metrics (docs/api-specification.md §8.2).
      class SummariesController < BaseController
        include Api::AnalyticsFilters

        def show
          @population = analytics_population
          @summary = ::Analytics::SummaryQuery.new(@population).call
        end
      end
    end
  end
end
