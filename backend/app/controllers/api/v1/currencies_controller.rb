module Api
  module V1
    # GET /api/v1/currencies — read-only reference list, ordered by code (API spec §5, D15).
    class CurrenciesController < BaseController
      def index
        @currencies = Currency.order(:code)
      end
    end
  end
end
