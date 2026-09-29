module Api
  module V1
    module Analytics
      # GET /api/v1/analytics/breakdown?by=country|department (docs/api-specification.md §8.4).
      class BreakdownsController < BaseController
        include Api::AnalyticsFilters

        def show
          @by = by_param
          @population = analytics_population
          @rows = ::Analytics::BreakdownQuery.new(@population, by: @by).call
        end

        private

        # Required; only the fixed dimensions are accepted (BACKEND_PLAN.md M5).
        def by_param
          allowed = ::Analytics::BreakdownQuery::DIMENSIONS.keys
          enum_param(:by, allowed) || raise(Api::BadRequest.new(:by, "must be one of: #{allowed.join(', ')}"))
        end
      end
    end
  end
end
