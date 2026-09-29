require "test_helper"

# /api/v1/employees/:employee_id/salary_records (docs/api-specification.md §7).
class Api::V1::SalaryRecordsTest < ActionDispatch::IntegrationTest
  RECORD_KEYS = %w[id employee_id amount currency_code period effective_from effective_to status editable created_at updated_at].freeze

  setup do
    travel_to Time.utc(2026, 9, 28, 10, 15, 0)
    sign_in
    @employee = create(:employee, hired_on: Date.new(2021, 4, 12))
  end

  # Historical, current, and scheduled records for @employee.
  def create_history
    @historical = create(:salary_record, employee: @employee, amount: "80000", effective_from: Date.new(2025, 4, 1), effective_to: Date.new(2026, 3, 31))
    @current = create(:salary_record, employee: @employee, amount: "85000", effective_from: Date.new(2026, 4, 1), effective_to: Date.new(2027, 3, 31))
    @scheduled = create(:salary_record, employee: @employee, amount: "92000", effective_from: Date.new(2027, 4, 1))
  end

  def change(employee: @employee, **attributes)
    post api_v1_employee_salary_records_path(employee), params: { salary_record: attributes }, as: :json
  end

  def correct(record, employee: @employee, **attributes)
    patch api_v1_employee_salary_record_path(employee, record), params: { salary_record: attributes }, as: :json
  end

  # --- authorization and routes --------------------------------------------------------------

  test "every salary action requires sign-in" do
    create_history
    delete api_v1_session_path

    [ [ :get, api_v1_employee_salary_records_path(@employee) ], [ :get, api_v1_employee_salary_record_path(@employee, @current) ],
      [ :post, api_v1_employee_salary_records_path(@employee) ], [ :patch, api_v1_employee_salary_record_path(@employee, @current) ] ].each do |verb, url|
      send(verb, url, as: :json)
      assert_response :unauthorized, "#{verb.upcase} #{url}"
    end
  end

  test "there is no DELETE route and records are never deleted (I12)" do
    create_history

    delete api_v1_employee_salary_record_path(@employee, @historical)

    assert_response :not_found
    assert SalaryRecord.exists?(@historical.id)
  end

  test "an unknown employee returns 404 for every action" do
    [ [ :get, "/api/v1/employees/999999999/salary_records" ], [ :post, "/api/v1/employees/999999999/salary_records" ] ].each do |verb, url|
      send(verb, url, params: { salary_record: { amount: "1" } }, as: :json)
      assert_response :not_found, "#{verb.upcase} #{url}"
    end
  end

  # --- history --------------------------------------------------------------------------------

  test "history is newest first with status, editable, and money formatting" do
    create_history

    get api_v1_employee_salary_records_path(@employee)

    assert_response :ok
    data = json["data"]
    assert_equal RECORD_KEYS, data.first.keys
    assert_equal [ @scheduled.id, @current.id, @historical.id ], data.map { |r| r["id"] }
    assert_equal [ [ "scheduled", true ], [ "current", true ], [ "historical", false ] ], data.map { |r| r.values_at("status", "editable") }
    assert_equal({ "amount" => "85000.00", "currency_code" => "INR", "period" => "monthly",
                   "effective_from" => "2026-04-01", "effective_to" => "2027-03-31" },
      data.second.slice("amount", "currency_code", "period", "effective_from", "effective_to"))
    assert_nil json["meta"], "history is unpaginated"
  end

  test "the history query count does not grow with the number of records (no N+1)" do
    employee = create(:employee, hired_on: Date.new(2010, 1, 1))
    add_years = lambda do |years|
      years.each_with_index do |year, i|
        create(:salary_record, employee: employee, amount: "70000", currency_code: i.even? ? "INR" : "USD",
          effective_from: Date.new(year, 1, 1), effective_to: Date.new(year, 12, 31))
      end
    end

    add_years.call(2013..2014)
    few = count_queries { get api_v1_employee_salary_records_path(employee) }
    add_years.call(2015..2024)
    many = count_queries { get api_v1_employee_salary_records_path(employee) }

    assert_equal 12, json["data"].size
    assert_equal few, many
  end

  test "an employee without salary records has an empty history" do
    get api_v1_employee_salary_records_path(@employee)

    assert_equal [], json["data"]
  end

  test "shows one record, and another employee's record is 404" do
    create_history
    other = create(:employee)

    get api_v1_employee_salary_record_path(@employee, @current)
    assert_response :ok
    assert_equal "current", json.dig("data", "status")

    get api_v1_employee_salary_record_path(other, @current)
    assert_response :not_found
  end

  # --- salary change (POST) -------------------------------------------------------------------

  test "the first salary is created open-ended and current" do
    change(amount: "85000.00", currency_code: "INR", effective_from: "2026-04-01")

    assert_response :created
    assert_equal({ "effective_to" => nil, "status" => "current", "editable" => true, "amount" => "85000.00" },
      json["data"].slice("effective_to", "status", "editable", "amount"))
  end

  test "a change closes the previous period the day before and keeps it in history" do
    change(amount: "85000.00", currency_code: "INR", effective_from: "2026-04-01")
    previous_id = json.dig("data", "id")

    change(amount: "92000.00", currency_code: "INR", effective_from: "2026-09-01")

    assert_response :created
    get api_v1_employee_salary_records_path(@employee)
    previous = json["data"].find { |r| r["id"] == previous_id }
    assert_equal [ "2026-08-31", "historical", "85000.00" ], previous.values_at("effective_to", "status", "amount")
    assert_equal 2, json["data"].size
  end

  test "a future-dated change is scheduled" do
    change(amount: "85000.00", currency_code: "INR", effective_from: "2026-04-01")
    change(amount: "92000.00", currency_code: "INR", effective_from: "2027-04-01")

    assert_response :created
    assert_equal "scheduled", json.dig("data", "status")
  end

  test "backdated, same-date, and pre-hire changes are rejected with 422" do
    change(amount: "85000.00", currency_code: "INR", effective_from: "2026-04-01")

    { "2026-04-01" => "must be after the latest salary record's start date",
      "2026-01-01" => "must be after the latest salary record's start date" }.each do |date, message|
      change(amount: "90000.00", currency_code: "INR", effective_from: date)
      assert_response :unprocessable_entity
      assert_equal({ "effective_from" => [ message ] }, json.dig("error", "details"))
    end

    change(amount: "1000", currency_code: "INR", effective_from: "2021-01-01", employee: create(:employee, hired_on: Date.new(2021, 4, 12)))
    assert_equal [ "must not be before the employee's hire date" ], json.dig("error", "details", "effective_from")
  end

  test "amount, currency, and decimal places are validated" do
    change(amount: "250000.5", currency_code: "JPY", effective_from: "2026-04-01")
    assert_response :unprocessable_entity
    assert_equal [ "must have at most 0 decimal places for this currency" ], json.dig("error", "details", "amount")

    change(amount: "0", currency_code: "XXX", effective_from: "2026-04-01")
    assert_equal %w[amount currency_code], json.dig("error", "details").keys.sort
    assert_not_includes response.body, "XXX", "errors do not echo submitted values"

    change(amount: "1500.125", currency_code: "KWD", effective_from: "2026-04-01")
    assert_response :created
    assert_equal "1500.125", json.dig("data", "amount")
  end

  test "the body must be wrapped, and employee or end date in the body are ignored" do
    post api_v1_employee_salary_records_path(@employee), params: { amount: "1" }, as: :json
    assert_response :bad_request
    assert_equal({ "salary_record" => [ "is required" ] }, json.dig("error", "details"))

    other = create(:employee)
    change(amount: "85000.00", currency_code: "INR", effective_from: "2026-04-01", employee_id: other.id, effective_to: "2026-12-31")
    assert_response :created
    assert_equal [ @employee.id, nil ], json["data"].values_at("employee_id", "effective_to")
  end

  # --- correction (PATCH) ---------------------------------------------------------------------

  test "the current and a scheduled record can be corrected" do
    create_history

    correct(@current, amount: "86000.00")
    assert_response :ok
    assert_equal "86000.00", json.dig("data", "amount")

    correct(@scheduled, amount: "93000", currency_code: "USD")
    assert_response :ok
    assert_equal [ "93000.00", "USD" ], json["data"].values_at("amount", "currency_code")
  end

  test "a historical record returns 422 salary_record_not_editable and is unchanged" do
    create_history

    correct(@historical, amount: "1.00")

    assert_response :unprocessable_entity
    assert_equal({ "code" => "salary_record_not_editable", "message" => "Historical salary records cannot be changed." }, json["error"])
    assert_equal BigDecimal("80000"), @historical.reload.amount
  end

  test "dates cannot be changed by a correction" do
    create_history

    correct(@current, effective_from: "2026-05-01", effective_to: "2026-12-31")

    assert_response :unprocessable_entity
    assert_equal "validation_failed", json.dig("error", "code")
    assert_equal({ "effective_from" => [ "cannot be changed" ], "effective_to" => [ "cannot be changed" ] }, json.dig("error", "details"))
    assert_equal Date.new(2026, 4, 1), @current.reload.effective_from
  end

  test "an invalid correction is rejected and leaves the record unchanged" do
    create_history

    correct(@current, currency_code: "JPY", amount: "85000.50")

    assert_response :unprocessable_entity
    assert_equal %w[amount], json.dig("error", "details").keys
    assert_equal "INR", @current.reload.currency_code
  end

  test "another employee's record cannot be corrected" do
    create_history

    correct(@current, amount: "1.00", employee: create(:employee))

    assert_response :not_found
    assert_equal BigDecimal("85000"), @current.reload.amount
  end

  # --- privacy (L17) --------------------------------------------------------------------------

  # Architecture §7: production logs at info, so request parameters must be filtered and SQL (which mysql2
  # writes with inline values, since prepared statements are off) is not logged. Debug-level SQL in
  # development/test does contain values; that is accepted for synthetic data only (see BACKEND_PLAN.md 4.4 notes).
  test "at the production log level, salary amounts and personal data never appear in logs" do
    create_history
    output = StringIO.new
    capture_logger = ActiveSupport::Logger.new(output, level: :info)
    loggers = [ Rails, ActionController::Base, ActiveRecord::Base ].to_h { |owner| [ owner, owner.logger ] }
    loggers.each_key { |owner| owner.logger = capture_logger }

    change(amount: "123456.78", currency_code: "USD", effective_from: "2027-06-01")
    correct(@current, amount: "87654.32")
    patch api_v1_employee_path(@employee), params: { employee: { first_name: "Zenobia", email: "zenobia@example.test" } }, as: :json

    log = output.string
    assert_includes log, "Processing by Api::V1::SalaryRecordsController#create"
    %w[123456.78 87654.32 Zenobia zenobia@example.test].each { |value| assert_not_includes log, value }
    assert_includes log, %("salary_record" => "[FILTERED]").delete(" ")
  ensure
    loggers&.each { |owner, logger| owner.logger = logger }
  end

  test "production defaults to the info log level" do
    production = Rails.root.join("config/environments/production.rb").read

    assert_match(/config\.log_level = ENV\.fetch\("RAILS_LOG_LEVEL", "info"\)/, production)
  end
end
