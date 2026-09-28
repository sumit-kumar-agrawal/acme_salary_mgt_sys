module Api
  module V1
    # /api/v1/employees/:employee_id/salary_records (docs/api-specification.md §7).
    # Writes go through the history services only; there is no destroy action (I12).
    # Records are always looked up through the employee, so another employee's record is a 404.
    class SalaryRecordsController < BaseController
      CHANGE_FIELDS = %i[amount currency_code effective_from].freeze
      # Dates are passed through so CorrectionService can reject them as "cannot be changed" (§7.5).
      CORRECTION_FIELDS = %i[amount currency_code effective_from effective_to].freeze
      ERROR_KEYS = { "currency" => "currency_code" }.freeze

      before_action :set_employee

      def index
        @salary_records = @employee.salary_records.includes(:currency).newest_first
      end

      def show
        @salary_record = find_salary_record
      end

      # Salary change: closes the previous period and opens a new one (§7.3).
      def create
        @salary_record = Salaries::ChangeService.call(
          employee: @employee, attributes: params.require(:salary_record).permit(*CHANGE_FIELDS)
        )
        return render_salary_errors unless @salary_record.persisted?

        render :show, status: :created
      end

      # Correction of a current or scheduled record (§7.5, D4 + O1).
      def update
        @salary_record = Salaries::CorrectionService.call(
          record: find_salary_record, attributes: params.require(:salary_record).permit(*CORRECTION_FIELDS)
        )
        return render_salary_errors if @salary_record.errors.any?

        render :show
      end

      private

      def set_employee
        @employee = Employee.find(params[:employee_id])
      end

      def find_salary_record
        @employee.salary_records.includes(:currency).find(params[:id])
      end

      # L16: historical record → salary_record_not_editable; everything else → validation_failed.
      def render_salary_errors
        if @salary_record.errors.of_kind?(:base, :not_editable)
          return render_error(:unprocessable_entity, "salary_record_not_editable",
            "Historical salary records cannot be changed.")
        end

        details = @salary_record.errors.to_hash.transform_keys { |key| ERROR_KEYS.fetch(key.to_s, key.to_s) }
        render_error(:unprocessable_entity, "validation_failed", "Please correct the highlighted fields.", details: details)
      end
    end
  end
end
