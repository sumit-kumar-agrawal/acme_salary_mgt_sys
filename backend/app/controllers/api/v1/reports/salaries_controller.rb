module Api
  module V1
    module Reports
      # GET /api/v1/reports/salaries: paginated record-level salary report (docs/api-specification.md §9.1, D19).
      # GET /api/v1/reports/salaries.csv: the same rows as a download (§9.2, D24); page and per_page are ignored.
      class SalariesController < BaseController
        include Api::AnalyticsFilters

        allow_csv :index

        def index
          @q = string_param(:q, max: 100)
          @population = analytics_population
          report = SalaryReportQuery.new(@population).call(
            q: @q, sort: sort_param(allowed: SalaryReportQuery::SORTABLE, default: "employee_number")
          )
          return send_csv(report) if request.format.csv?

          @salary_records = paginate(report)
        end

        private

        # Errors stay JSON envelopes (render_error renders JSON); nothing is truncated over the cap.
        def send_csv(report)
          send_data SalaryReportCsv.new(report).generate, type: "text/csv; charset=utf-8",
            disposition: "attachment", filename: "salary-report-#{@population.as_of.iso8601}.csv"
        rescue SalaryReportCsv::TooLarge
          render_error(:unprocessable_entity, "export_too_large",
            "Narrow the filters to export at most #{SalaryReportCsv.max_rows.to_fs(:delimited)} rows.")
        end
      end
    end
  end
end
