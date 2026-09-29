module Api
  # Shared analytics and report filters (docs/api-specification.md §8.1, §9; BACKEND_PLAN.md M8, M12).
  # Parameters are validated by Api::QueryParams, so invalid values return 400 rather than a default.
  # Responses carry salary data, so they are marked Cache-Control: no-store.
  module AnalyticsFilters
    extend ActiveSupport::Concern

    included do
      before_action :no_store
    end

    private

    def analytics_population
      @analytics_population ||= ::Analytics::Population.new(
        as_of: date_param(:as_of) || Date.current,
        country_id: id_param(:country_id, Country),
        department_id: id_param(:department_id, Department),
        employment_status: enum_param(:employment_status, Employee.employment_statuses.keys)
      )
    end
  end
end
