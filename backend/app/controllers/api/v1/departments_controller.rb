module Api
  module V1
    # GET /api/v1/departments — read-only reference list, ordered by name (API spec §5, D15).
    class DepartmentsController < BaseController
      def index
        @departments = Department.order(:name)
      end
    end
  end
end
