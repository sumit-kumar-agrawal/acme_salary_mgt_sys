require "test_helper"

# GET /api/v1/reports/salaries (docs/api-specification.md §9.1, D19).
class Api::V1::SalaryReportTest < ActionDispatch::IntegrationTest
  ROW_KEYS = %w[employee_id employee_number first_name last_name country department employment_status
                amount currency_code period effective_from].freeze

  setup do
    travel_to Time.utc(2026, 9, 28, 10, 15, 0)
    sign_in
  end

  def paid(amount, currency_code = "INR", effective_from: Date.new(2026, 4, 1), **employee_attributes)
    employee = create(:employee, **employee_attributes)
    create(:salary_record, employee: employee, amount: amount, currency_code: currency_code, effective_from: effective_from)
    employee
  end

  def report(params = {})
    get api_v1_reports_salaries_path, params: params
    assert_response :ok, response.body
    json
  end

  def numbers(params = {})
    report(params)["data"].map { |row| row["employee_number"] }
  end

  test "requires sign-in" do
    delete api_v1_session_path

    get api_v1_reports_salaries_path

    assert_response :unauthorized
    assert_equal "unauthenticated", json.dig("error", "code")
  end

  test "rows and meta have the documented shape, without email, and the response is no-store" do
    paid("85000.00", "INR", employee_number: "EMP-00123", first_name: "Asha", last_name: "Rao",
      country: countries(:india), department: departments(:engineering))

    body = report(country_id: countries(:india).id)

    assert_equal "no-store", response.headers["Cache-Control"]
    row = body["data"].sole
    assert_equal ROW_KEYS, row.keys
    assert_equal({ "employee_number" => "EMP-00123", "first_name" => "Asha", "last_name" => "Rao",
                   "country" => { "code" => "IN", "name" => "India" }, "department" => { "name" => "Engineering" },
                   "employment_status" => "active", "amount" => "85000.00", "currency_code" => "INR",
                   "period" => "monthly", "effective_from" => "2026-04-01" }, row.except("employee_id"))
    assert_equal({ "page" => 1, "per_page" => 25, "total_count" => 1, "total_pages" => 1, "as_of" => "2026-09-28",
                   "filters" => { "country_id" => countries(:india).id, "department_id" => nil,
                                  "employment_status" => %w[active on_leave], "q" => nil } }, body["meta"])
  end

  test "includes only employees in scope with a salary in effect on as_of" do
    paid("50000.00", employee_number: "EMP-00001")
    paid("60000.00", employee_number: "EMP-00002", employment_status: "terminated")
    paid("70000.00", employee_number: "EMP-00003", effective_from: Date.new(2027, 1, 1))
    create(:employee, employee_number: "EMP-00004")

    assert_equal %w[EMP-00001], numbers
    assert_equal %w[EMP-00002], numbers(employment_status: "terminated")
    assert_equal %w[EMP-00001 EMP-00003], numbers(as_of: "2027-01-01")
  end

  test "q searches number and names" do
    paid("50000.00", employee_number: "EMP-00042", first_name: "José", last_name: "García")
    paid("50000.00", employee_number: "EMP-00077", first_name: "Asha", last_name: "Rao")

    assert_equal %w[EMP-00042], numbers(q: "garc")
    assert_equal "garc", json.dig("meta", "filters", "q")
    assert_equal %w[EMP-00077], numbers(q: "00077")
    assert_equal [], numbers(q: "%")
  end

  test "sorts by employee_number, last_name, and amount grouped by currency" do
    paid("5000.00", "EUR", employee_number: "EMP-00001", last_name: "Zed", first_name: "Ann")
    paid("90000.00", "INR", employee_number: "EMP-00002", last_name: "Adams", first_name: "Bo")
    paid("7000.00", "EUR", employee_number: "EMP-00003", last_name: "Adams", first_name: "Al")
    paid("30000.00", "INR", employee_number: "EMP-00004", last_name: "Moss", first_name: "Cy")

    assert_equal %w[EMP-00001 EMP-00002 EMP-00003 EMP-00004], numbers
    assert_equal %w[EMP-00004 EMP-00003 EMP-00002 EMP-00001], numbers(sort: "-employee_number")
    assert_equal %w[EMP-00003 EMP-00002 EMP-00004 EMP-00001], numbers(sort: "last_name")
    assert_equal %w[EMP-00001 EMP-00003 EMP-00004 EMP-00002], numbers(sort: "amount")
    assert_equal %w[EMP-00003 EMP-00001 EMP-00002 EMP-00004], numbers(sort: "-amount")
  end

  test "paginates with meta, including a page past the end" do
    3.times { paid("50000.00") }

    body = report(per_page: 2, page: 2)
    assert_equal 1, body["data"].size
    assert_equal [ 2, 2, 3, 2 ], body["meta"].values_at("page", "per_page", "total_count", "total_pages")

    assert_empty report(per_page: 2, page: 3)["data"]
  end

  test "invalid parameters return 400 naming the parameter" do
    {
      { sort: "email" } => "sort", { per_page: 101 } => "per_page", { page: "99999999999999999999" } => "page", { q: "a" * 101 } => "q",
      { as_of: "yesterday" } => "as_of", { country_id: 999_999 } => "country_id"
    }.each do |params, key|
      get api_v1_reports_salaries_path, params: params
      assert_response :bad_request, params.inspect
      assert_equal [ key ], json.dig("error", "details").keys, params.inspect
    end
  end

  test "the query count does not grow with the number of rows (no N+1)" do
    2.times { paid("50000.00") }
    few = count_queries { get api_v1_reports_salaries_path }
    10.times { paid("7000.00", "EUR", country: countries(:germany), department: departments(:sales)) }
    many = count_queries { get api_v1_reports_salaries_path }

    assert_equal 12, json["data"].size
    assert_equal few, many
  end
end
