require "test_helper"

# At the production log level (info), names, emails, amounts, and search terms never reach the log
# (security rules; architecture §7; BACKEND_PLAN.md L17, N7). Salary writes, employee update, and login
# are covered in salary_records_test.rb and sessions_test.rb; this file covers employee create and searches.
class Api::V1::LogRedactionTest < ActionDispatch::IntegrationTest
  setup do
    travel_to Time.utc(2026, 9, 28, 10, 15, 0)
    sign_in
  end

  def capture_info_log
    output = StringIO.new
    capture_logger = ActiveSupport::Logger.new(output, level: :info)
    loggers = [ Rails, ActionController::Base, ActiveRecord::Base ].to_h { |owner| [ owner, owner.logger ] }
    loggers.each_key { |owner| owner.logger = capture_logger }
    yield
    output.string
  ensure
    loggers&.each { |owner, logger| owner.logger = logger }
  end

  test "employee create logs no names, email, or salary" do
    log = capture_info_log do
      post api_v1_employees_path, as: :json, params: { employee: {
        employee_number: "EMP-10001", first_name: "Zenobia", last_name: "Quartermaine", email: "zenobia.q@example.test",
        country_id: countries(:india).id, department_id: departments(:engineering).id, hired_on: "2021-04-12",
        initial_salary: { amount: "123456.78", currency_code: "INR", effective_from: "2026-04-01" }
      } }
    end

    assert_response :created
    assert_includes log, "Processing by Api::V1::EmployeesController#create"
    %w[Zenobia Quartermaine zenobia.q@example.test 123456.78].each { |value| assert_not_includes log, value }
  end

  test "search terms are filtered from the request line and parameters" do
    log = capture_info_log do
      get api_v1_employees_path(q: "Garcia", sort: "last_name")
      get api_v1_reports_salaries_path(q: "Garcia")
      get api_v1_reports_salaries_path(q: "Garcia", format: :csv)
    end

    assert_not_includes log, "Garcia"
    assert_equal 3, log.scan(/Started GET "[^"]*q=\[FILTERED\]/).size, log
    assert_includes log, "sort=last_name", "only q is filtered; other parameters stay readable"
  end
end
