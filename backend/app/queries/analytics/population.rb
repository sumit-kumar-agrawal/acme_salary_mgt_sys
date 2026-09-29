module Analytics
  # The employees and salaries every analytics query and the salary report share (BACKEND_PLAN.md M1, D20).
  # Inputs are validated by the controller (Api::QueryParams); this class only builds relations.
  #
  # Country, department, and status are current values (no attribute history, requirements §7), so a past
  # as_of reflects today's attributes. Employees hired after as_of are not in scope (M2).
  class Population
    DEFAULT_STATUSES = %w[active on_leave].freeze

    attr_reader :as_of, :country_id, :department_id, :statuses

    def initialize(as_of: Date.current, country_id: nil, department_id: nil, employment_status: nil)
      @as_of = as_of
      @country_id = country_id
      @department_id = department_id
      @statuses = employment_status ? [ employment_status ] : DEFAULT_STATUSES
    end

    # The applied filters as echoed by the API (docs/api-specification.md §8.1, BACKEND_PLAN.md M8).
    def filters
      { country_id: country_id, department_id: department_id, employment_status: statuses }
    end

    # Employees matching the filters and hired on or before as_of (a missing hired_on counts as hired).
    def employees
      scope = Employee.where(employment_status: statuses)
      scope = scope.where(country_id: country_id) if country_id
      scope = scope.where(department_id: department_id) if department_id
      scope.where("employees.hired_on IS NULL OR employees.hired_on <= ?", as_of)
    end

    # The salary in effect on as_of for each employee in scope: at most one row per employee (D7, I10).
    def salaries
      SalaryRecord.in_effect_on(as_of).joins(:employee).merge(employees)
    end
  end
end
