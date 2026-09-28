module Api
  module V1
    # GET /api/v1/countries — read-only reference list, ordered by name (API spec §5, D15).
    class CountriesController < BaseController
      def index
        @countries = Country.order(:name)
      end
    end
  end
end
