require "test_helper"
require "csv"

# GET /api/v1/reports/salaries.csv (docs/api-specification.md §9.2, D24).
class Api::V1::SalaryReportCsvTest < ActionDispatch::IntegrationTest
  HEADERS = %w[employee_number first_name last_name country_code country_name department employment_status
               monthly_amount currency_code effective_from].freeze

  setup do
    travel_to Time.utc(2026, 9, 28, 10, 15, 0)
    sign_in
  end

  def paid(amount, currency_code = "INR", effective_from: Date.new(2026, 4, 1), **employee_attributes)
    employee = create(:employee, **employee_attributes)
    create(:salary_record, employee: employee, amount: amount, currency_code: currency_code, effective_from: effective_from)
    employee
  end

  def csv_url(params = {})
    api_v1_reports_salaries_path(params.merge(format: :csv))
  end

  # Parsed rows without the header; the BOM is checked separately.
  def download(params = {})
    get csv_url(params)
    assert_response :ok, response.body
    CSV.parse(response.body.delete_prefix("﻿"))
  end

  test "sends an attachment with the documented headers, a BOM, and the column allowlist" do
    paid("85000.00", "INR", employee_number: "EMP-00123", first_name: "Asha", last_name: "Rao", email: "asha@example.test",
      country: countries(:india), department: departments(:engineering))

    get csv_url

    assert_response :ok
    assert_equal "text/csv; charset=utf-8", response.media_type + "; charset=" + response.charset.downcase
    assert_match(/\Aattachment; filename="salary-report-2026-09-28\.csv"/, response.headers["Content-Disposition"])
    assert_equal "no-store", response.headers["Cache-Control"]
    assert response.body.start_with?("﻿"), "UTF-8 byte-order mark"

    rows = CSV.parse(response.body.delete_prefix("﻿"))
    assert_equal HEADERS, rows.first
    assert_equal %w[EMP-00123 Asha Rao IN India Engineering active 85000.00 INR 2026-04-01], rows.second
    refute_includes response.body, "asha@example.test"
  end

  test "rows and order equal the JSON report pages for the same filters and sort" do
    paid("5000.00", "EUR", first_name: "Ann", last_name: "Zed")
    paid("90000.00", "INR", first_name: "Bo", last_name: "Adams")
    paid("7000.00", "EUR", first_name: "Al", last_name: "Adams")
    paid("30000.00", "INR", first_name: "Cy", last_name: "Moss")
    paid("40000.00", "INR", first_name: "Di", last_name: "Kent", employment_status: "terminated")

    params = { sort: "-amount", q: "a" }
    json_rows = (1..3).flat_map do |page|
      get api_v1_reports_salaries_path(params.merge(page: page, per_page: 2))
      json["data"].map { |row| [ row["employee_number"], row["amount"], row["currency_code"] ] }
    end

    csv_rows = download(params).drop(1).map { |row| row.values_at(0, 7, 8) }
    assert_equal json_rows, csv_rows
    assert_equal 3, csv_rows.size, "q and the default status filter apply"
  end

  test "amounts use each currency's minor units, and page and per_page are ignored" do
    paid("250000", "JPY", employee_number: "EMP-00001")
    paid("1500.125", "KWD", employee_number: "EMP-00002")
    paid("85000.5", "INR", employee_number: "EMP-00003")

    rows = download(page: 9, per_page: 1).drop(1)
    assert_equal [ %w[EMP-00001 250000 JPY], %w[EMP-00002 1500.125 KWD], %w[EMP-00003 85000.50 INR] ],
      rows.map { |row| row.values_at(0, 7, 8) }
  end

  test "text cells that a spreadsheet would run as a formula are prefixed with a quote" do
    { "=SUM(A1)" => "'=SUM(A1)", "+1" => "'+1", "-2" => "'-2", "@cmd" => "'@cmd", "\tTab" => "'\tTab",
      "\rReturn" => "'\rReturn", "Plain" => "Plain", "O'Brien" => "O'Brien" }.each_with_index do |(name, expected), i|
      employee = paid("1000.00", employee_number: format("EMP-%05d", i + 1))
      # Bypass the model's whitespace normalisation: data written outside the app must still be neutralised.
      Employee.where(id: employee.id).update_all([ "first_name = ?", name ])

      assert_equal expected, download.last[1], name.inspect
    end
  end

  test "a result over the row cap returns 422 export_too_large as JSON and nothing is truncated" do
    3.times { paid("1000.00") }

    with_max_rows(2) { get csv_url }

    assert_response :unprocessable_entity
    assert_equal "application/json", response.media_type
    assert_equal "export_too_large", json.dig("error", "code")
    assert_equal "Narrow the filters to export at most 2 rows.", json.dig("error", "message")

    with_max_rows(3) { assert_equal 4, download.size, "exactly the cap is allowed" }
  end

  test "errors are JSON envelopes, never CSV" do
    get csv_url(country_id: 999_999)
    assert_response :bad_request
    assert_equal "application/json", response.media_type
    assert_equal [ "country_id" ], json.dig("error", "details").keys

    delete api_v1_session_path
    get csv_url
    assert_response :unauthorized
    assert_equal "application/json", response.media_type
    assert_equal "unauthenticated", json.dig("error", "code")
  end

  test "only json and csv are served; other formats and CSV on analytics are not" do
    get "/api/v1/reports/salaries.xml"
    assert_response :not_found
    assert_equal "application/json", response.media_type

    get api_v1_analytics_summary_path(format: :csv)
    assert_response :ok
    assert_equal "application/json", response.media_type
  end

  test "an empty result is a header-only file" do
    assert_equal [ HEADERS ], download
  end

  private

  # minitest 6 has no minitest/mock, so swap the class method and restore it afterwards (see health_test.rb).
  def with_max_rows(limit)
    original = SalaryReportCsv.method(:max_rows)
    SalaryReportCsv.define_singleton_method(:max_rows) { limit }
    yield
  ensure
    SalaryReportCsv.define_singleton_method(:max_rows, original)
  end
end
