module Api
  module V1
    module Analytics
      # GET /api/v1/analytics/distribution: ten salary bands per currency (docs/api-specification.md §8.3).
      class DistributionsController < BaseController
        include Api::AnalyticsFilters

        def show
          @population = analytics_population
          @distribution = ::Analytics::DistributionQuery.new(@population).call
        end
      end
    end
  end
end
