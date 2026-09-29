require "test_helper"

# GET /api/v1/analytics/summary, /distribution, /breakdown (docs/api-specification.md §8).
# Metric arithmetic is covered by test/queries/analytics; these tests cover the HTTP contract.
class Api::V1::AnalyticsTest < ActionDispatch::IntegrationTest
  DEFAULT_FILTERS = { "country_id" => nil, "department_id" => nil, "employment_status" => %w[active on_leave] }.freeze
  EMPLOYEE_FIELDS = %w[employee_id employee_number first_name last_name email amount effective_from].freeze

  setup do
    travel_to Time.utc(2026, 9, 28, 10, 15, 0)
    sign_in
  end

  def paid(amount, currency_code, effective_from: Date.new(2026, 4, 1), **employee_attributes)
    employee = create(:employee, **employee_attributes)
    create(:salary_record, employee: employee, amount: amount, currency_code: currency_code, effective_from: effective_from)
    employee
  end

  def all_keys(value)
    case value
    when Hash then value.keys + value.values.flat_map { |v| all_keys(v) }
    when Array then value.flat_map { |v| all_keys(v) }
    else []
    end
  end

  # --- authorization and headers ---------------------------------------------------------------

  test "every analytics endpoint requires sign-in" do
    delete api_v1_session_path

    [ api_v1_analytics_summary_path, api_v1_analytics_distribution_path,
      api_v1_analytics_breakdown_path(by: "country") ].each do |url|
      get url
      assert_response :unauthorized, url
      assert_equal "unauthenticated", json.dig("error", "code")
    end
  end

  test "responses are marked no-store and contain no employee-level fields" do
    paid("85000.00", "INR")

    [ api_v1_analytics_summary_path, api_v1_analytics_distribution_path,
      api_v1_analytics_breakdown_path(by: "department") ].each do |url|
      get url
      assert_response :ok, url
      assert_equal "no-store", response.headers["Cache-Control"], url
      assert_empty all_keys(json) & EMPLOYEE_FIELDS, url
    end
  end

  # --- summary ---------------------------------------------------------------------------------

  test "summary has the documented shape with amounts rounded to each currency's minor units" do
    %w[30000.00 50000.00 100000.00].each { |amount| paid(amount, "INR") }
    %w[100001 100002].each { |amount| paid(amount, "JPY") }
    paid("1000.125", "KWD")
    create(:employee)

    get api_v1_analytics_summary_path

    assert_response :ok
    data = json["data"]
    assert_equal %w[as_of period filters employees_in_scope employees_without_salary by_currency], data.keys
    assert_equal [ "2026-09-28", "monthly", DEFAULT_FILTERS, 7, 1 ],
      data.values_at("as_of", "period", "filters", "employees_in_scope", "employees_without_salary")
    assert_equal [
      { "currency_code" => "INR", "employee_count" => 3, "total" => "180000.00", "average" => "60000.00",
        "median" => "50000.00", "min" => "30000.00", "max" => "100000.00" },
      { "currency_code" => "JPY", "employee_count" => 2, "total" => "200003", "average" => "100002",
        "median" => "100002", "min" => "100001", "max" => "100002" },
      { "currency_code" => "KWD", "employee_count" => 1, "total" => "1000.125", "average" => "1000.125",
        "median" => "1000.125", "min" => "1000.125", "max" => "1000.125" }
    ], data["by_currency"]
    refute data.key?("total"), "no cross-currency total"
  end

  test "filters and as_of are applied and echoed" do
    germany = countries(:germany)
    employee = create(:employee, country: germany, employment_status: "terminated")
    create(:salary_record, employee: employee, amount: "4000.00", currency_code: "EUR",
      effective_from: Date.new(2025, 1, 1), effective_to: Date.new(2026, 3, 31))
    create(:salary_record, employee: employee, amount: "5000.00", currency_code: "EUR", effective_from: Date.new(2026, 4, 1))
    paid("6000.00", "EUR", country: germany)

    get api_v1_analytics_summary_path(as_of: "2026-03-31", country_id: germany.id, employment_status: "terminated")

    assert_response :ok
    data = json["data"]
    assert_equal "2026-03-31", data["as_of"]
    assert_equal({ "country_id" => germany.id, "department_id" => nil, "employment_status" => %w[terminated] }, data["filters"])
    assert_equal [ [ "EUR", 1, "4000.00" ] ], data["by_currency"].map { |row| row.values_at("currency_code", "employee_count", "total") }
  end

  test "invalid filters return 400 naming the parameter" do
    {
      { as_of: "2026-13-01" } => "as_of", { as_of: "28/09/2026" } => "as_of", { country_id: 999_999 } => "country_id",
      { department_id: "abc" } => "department_id", { employment_status: "retired" } => "employment_status"
    }.each do |params, key|
      get api_v1_analytics_summary_path(params)
      assert_response :bad_request, params.inspect
      assert_equal "bad_request", json.dig("error", "code")
      assert_equal [ key ], json.dig("error", "details").keys, params.inspect
    end
  end

  # --- distribution ----------------------------------------------------------------------------

  test "distribution returns ten bands per currency with rounded edges and counts" do
    %w[1000.00 1100.00 2000.00].each { |amount| paid(amount, "USD") }
    2.times { paid("250000", "JPY") }

    get api_v1_analytics_distribution_path

    assert_response :ok
    data = json["data"]
    assert_equal %w[as_of period filters by_currency], data.keys
    jpy, usd = data["by_currency"]
    assert_equal({ "currency_code" => "JPY", "employee_count" => 2,
                   "bands" => [ { "lower" => "250000", "upper" => "250000", "count" => 2 } ] }, jpy)
    assert_equal [ "USD", 3, 10 ], [ usd["currency_code"], usd["employee_count"], usd["bands"].size ]
    assert_equal({ "lower" => "1100.00", "upper" => "1200.00", "count" => 1 }, usd["bands"][1])
    assert_equal [ 1, 1, 0, 0, 0, 0, 0, 0, 0, 1 ], usd["bands"].map { |band| band["count"] }
  end

  # --- breakdown -------------------------------------------------------------------------------

  test "breakdown by country is keyed by dimension and currency" do
    germany = countries(:germany)
    paid("5000.00", "EUR", country: germany)
    paid("6000.00", "EUR", country: germany)
    paid("6500.00", "USD", country: germany)

    get api_v1_analytics_breakdown_path(by: "country")

    assert_response :ok
    data = json["data"]
    assert_equal %w[as_of period by filters rows], data.keys
    assert_equal "country", data["by"]
    assert_equal [
      { "dimension" => { "id" => germany.id, "code" => "DE", "name" => "Germany" }, "currency_code" => "EUR",
        "employee_count" => 2, "total" => "11000.00", "average" => "5500.00", "median" => "5500.00" },
      { "dimension" => { "id" => germany.id, "code" => "DE", "name" => "Germany" }, "currency_code" => "USD",
        "employee_count" => 1, "total" => "6500.00", "average" => "6500.00", "median" => "6500.00" }
    ], data["rows"]
  end

  test "breakdown by department has no dimension code and honours other filters" do
    paid("5000.00", "EUR", country: countries(:germany), department: departments(:finance))
    paid("9000.00", "INR", department: departments(:finance))

    get api_v1_analytics_breakdown_path(by: "department", country_id: countries(:germany).id)

    assert_response :ok
    rows = json.dig("data", "rows")
    assert_equal [ { "id" => departments(:finance).id, "name" => "Finance" } ], rows.map { |row| row["dimension"] }
  end

  test "breakdown requires a valid by parameter" do
    [ {}, { by: "employee" }, { by: "employees.id" } ].each do |params|
      get api_v1_analytics_breakdown_path(params)
      assert_response :bad_request, params.inspect
      assert_equal [ "by" ], json.dig("error", "details").keys
    end
  end
end
