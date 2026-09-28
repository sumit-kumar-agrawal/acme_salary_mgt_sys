module Api
  module V1
    # GET/POST /api/v1/employees, GET/PATCH /api/v1/employees/:id (docs/api-specification.md §6).
    # There is no destroy action: employees are terminated, never deleted (D13, I12).
    class EmployeesController < BaseController
      PERMITTED = %i[employee_number first_name last_name email country_id department_id employment_status hired_on].freeze
      INITIAL_SALARY = %i[amount currency_code effective_from].freeze
      # Report association errors under the request's field names.
      ERROR_KEYS = {
        "country" => "country_id",
        "department" => "department_id",
        "initial_salary.currency" => "initial_salary.currency_code"
      }.freeze

      def index
        employees = EmployeeSearchQuery.new.call(
          q: string_param(:q, max: 100),
          country_id: id_param(:country_id, Country),
          department_id: id_param(:department_id, Department),
          employment_status: enum_param(:employment_status, Employee.employment_statuses.keys),
          sort: sort_param(allowed: EmployeeSearchQuery::SORTABLE, default: "employee_number")
        )
        @employees = paginate(employees)
      end

      def show
        @employee = find_employee
        render_employee
      end

      def create
        @employee = Employees::CreateService.call(
          attributes: params.require(:employee).permit(*PERMITTED, initial_salary: INITIAL_SALARY)
        )
        return render_employee_errors unless @employee.persisted?

        render_employee(status: :created)
      end

      def update
        @employee = find_employee
        return render_employee_errors unless @employee.update(params.require(:employee).permit(*PERMITTED))

        render_employee
      end

      private

      def find_employee
        Employee.includes(:country, :department).find(params[:id])
      end

      # Detail body (§6.2) with the salary in effect today (D7), or nil.
      def render_employee(status: :ok)
        @current_salary = @employee.salary_records.includes(:currency).in_effect_on(Date.current).first
        render :show, status: status
      end

      def render_employee_errors
        details = @employee.errors.to_hash.transform_keys { |key| ERROR_KEYS.fetch(key.to_s, key.to_s) }
        render_error(:unprocessable_entity, "validation_failed", "Please correct the highlighted fields.", details: details)
      end
    end
  end
end
