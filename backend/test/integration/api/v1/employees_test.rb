require "test_helper"

# GET/POST /api/v1/employees, GET/PATCH /api/v1/employees/:id (docs/api-specification.md §6).
class Api::V1::EmployeesTest < ActionDispatch::IntegrationTest
  SUMMARY_KEYS = %w[id employee_number first_name last_name country department employment_status hired_on].freeze

  setup do
    travel_to Time.utc(2026, 9, 28, 10, 15, 0)
    sign_in
  end

  def employee_body(overrides = {})
    {
      employee_number: "EMP-10001", first_name: "Asha", last_name: "Rao", email: "asha.rao@example.test",
      country_id: countries(:india).id, department_id: departments(:engineering).id,
      employment_status: "active", hired_on: "2021-04-12"
    }.merge(overrides)
  end

  def list(params = {})
    get api_v1_employees_path, params: params
    json
  end

  def numbers(params = {})
    list(params)["data"].map { |e| e["employee_number"] }
  end

  # --- authorization ---------------------------------------------------------------------------

  test "every employee action requires sign-in" do
    employee = create(:employee)
    delete api_v1_session_path

    [ [ :get, api_v1_employees_path ], [ :get, api_v1_employee_path(employee) ],
      [ :post, api_v1_employees_path ], [ :patch, api_v1_employee_path(employee) ] ].each do |verb, url|
      send(verb, url, as: :json)
      assert_response :unauthorized, "#{verb.upcase} #{url}"
    end
  end

  test "there is no DELETE route (I12)" do
    employee = create(:employee)

    delete api_v1_employee_path(employee)

    assert_response :not_found
    assert Employee.exists?(employee.id)
  end

  # --- list ------------------------------------------------------------------------------------

  test "list items have the documented shape and never include email or salary (D18)" do
    employee = create(:employee, employee_number: "EMP-00123", first_name: "Asha", last_name: "Rao",
      country: countries(:india), department: departments(:engineering), hired_on: Date.new(2021, 4, 12))
    create(:salary_record, employee: employee, effective_from: Date.new(2026, 4, 1))

    body = list
    item = body["data"].sole

    assert_equal SUMMARY_KEYS, item.keys
    assert_equal({ "id" => countries(:india).id, "code" => "IN", "name" => "India" }, item["country"])
    assert_equal({ "id" => departments(:engineering).id, "name" => "Engineering" }, item["department"])
    assert_equal "2021-04-12", item["hired_on"]
    assert_equal({ "page" => 1, "per_page" => 25, "total_count" => 1, "total_pages" => 1 }, body["meta"])
    assert_no_match(/email|amount|salary/, response.body)
  end

  test "filters by country, department, and status, alone and combined" do
    a = create(:employee, employee_number: "EMP-A", country: countries(:india), department: departments(:finance))
    create(:employee, employee_number: "EMP-B", country: countries(:japan), department: departments(:finance))
    create(:employee, employee_number: "EMP-C", country: countries(:india), department: departments(:sales), employment_status: "terminated")

    assert_equal %w[EMP-A EMP-C], numbers(country_id: countries(:india).id)
    assert_equal %w[EMP-A EMP-B], numbers(department_id: departments(:finance).id)
    assert_equal %w[EMP-C], numbers(employment_status: "terminated")
    assert_equal [ a.employee_number ], numbers(country_id: countries(:india).id, department_id: departments(:finance).id, employment_status: "active")
    assert_equal 3, list["meta"]["total_count"], "all statuses when employment_status is omitted"
  end

  test "q matches number, first and last name, ignoring case and accents" do
    create(:employee, employee_number: "EMP-00042", first_name: "José", last_name: "García")
    create(:employee, employee_number: "EMP-00077", first_name: "Asha", last_name: "Rao")

    assert_equal %w[EMP-00042], numbers(q: "00042")
    assert_equal %w[EMP-00042], numbers(q: "jose")
    assert_equal %w[EMP-00042], numbers(q: "GARC")
    assert_equal %w[EMP-00077], numbers(q: "sha")
    assert_equal [], numbers(q: "nobody")
  end

  test "q treats LIKE wildcards literally" do
    create(:employee, employee_number: "EMP-1", first_name: "Anna")

    assert_equal [], numbers(q: "%")
    assert_equal [], numbers(q: "A_na")
  end

  test "sorts by every allowlisted field, ascending and descending, with a stable id tie-break" do
    create(:employee, employee_number: "EMP-B", last_name: "Adams", first_name: "Zoe", hired_on: Date.new(2020, 1, 1), created_at: Time.utc(2026, 1, 1))
    create(:employee, employee_number: "EMP-A", last_name: "Brown", first_name: "Amy", hired_on: Date.new(2022, 1, 1), created_at: Time.utc(2026, 2, 1))
    create(:employee, employee_number: "EMP-C", last_name: "Adams", first_name: "Amy", hired_on: Date.new(2021, 1, 1), created_at: Time.utc(2026, 3, 1))

    assert_equal %w[EMP-A EMP-B EMP-C], numbers
    assert_equal %w[EMP-C EMP-B EMP-A], numbers(sort: "-employee_number")
    assert_equal %w[EMP-C EMP-B EMP-A], numbers(sort: "last_name"), "last_name then first_name"
    assert_equal %w[EMP-A EMP-B EMP-C], numbers(sort: "-last_name")
    assert_equal %w[EMP-B EMP-C EMP-A], numbers(sort: "hired_on")
    assert_equal %w[EMP-A EMP-C EMP-B], numbers(sort: "-hired_on")
    assert_equal %w[EMP-B EMP-A EMP-C], numbers(sort: "created_at")
    assert_equal %w[EMP-C EMP-A EMP-B], numbers(sort: "-created_at")
  end

  test "paginates with meta" do
    5.times { |i| create(:employee, employee_number: "EMP-#{i}") }

    body = list(page: 2, per_page: 2)

    assert_equal %w[EMP-2 EMP-3], body["data"].map { |e| e["employee_number"] }
    assert_equal({ "page" => 2, "per_page" => 2, "total_count" => 5, "total_pages" => 3 }, body["meta"])
  end

  test "invalid list parameters return 400 with details" do
    {
      { per_page: 101 } => "per_page", { page: 0 } => "page", { sort: "salary" } => "sort",
      { country_id: 999_999_999 } => "country_id", { department_id: "x" } => "department_id",
      { employment_status: "retired" } => "employment_status", { q: "a" * 101 } => "q"
    }.each do |params, key|
      get api_v1_employees_path, params: params

      assert_response :bad_request, params.inspect
      assert_equal [ key ], json.dig("error", "details").keys, params.inspect
    end
  end

  test "the list query count does not grow with the number of employees (no N+1)" do
    create_list(:employee, 2)
    few = count_queries { get api_v1_employees_path }
    create_list(:employee, 10, country: countries(:japan), department: departments(:sales))
    many = count_queries { get api_v1_employees_path }

    assert_equal 12, json["data"].size
    assert_equal few, many
  end

  # --- detail ----------------------------------------------------------------------------------

  test "detail adds email, the current salary formatted to the currency, and timestamps" do
    employee = create(:employee, email: "asha.rao@example.test")
    create(:salary_record, employee: employee, amount: "80000", effective_from: Date.new(2025, 4, 1), effective_to: Date.new(2026, 3, 31))
    current = create(:salary_record, employee: employee, amount: "85000", effective_from: Date.new(2026, 4, 1))

    get api_v1_employee_path(employee)

    assert_response :ok
    data = json["data"]
    assert_equal %w[id employee_number first_name last_name email country department employment_status hired_on current_salary created_at updated_at], data.keys
    assert_equal "asha.rao@example.test", data["email"]
    assert_equal({ "id" => current.id, "amount" => "85000.00", "currency_code" => "INR", "period" => "monthly",
                   "effective_from" => "2026-04-01", "effective_to" => nil }, data["current_salary"])
    assert_equal "2026-09-28T10:15:00Z", data["created_at"]
  end

  test "amounts use the currency's minor units" do
    employee = create(:employee)
    create(:salary_record, employee: employee, amount: "250000", currency_code: "JPY", effective_from: Date.new(2026, 1, 1))

    get api_v1_employee_path(employee)

    assert_equal "250000", json.dig("data", "current_salary", "amount")
  end

  test "current_salary is null without a salary in effect today, even with a scheduled one" do
    employee = create(:employee)
    create(:salary_record, employee: employee, effective_from: Date.new(2027, 1, 1))

    get api_v1_employee_path(employee)

    assert_nil json.dig("data", "current_salary")
  end

  test "unknown or malformed ids return 404" do
    [ api_v1_employee_path(999_999_999), "/api/v1/employees/abc" ].each do |url|
      get url
      assert_response :not_found, url
      assert_equal({ "code" => "not_found", "message" => "Not found." }, json["error"], "generic, no id or record data")
    end
  end

  # --- create ----------------------------------------------------------------------------------

  test "creates an employee, normalizing number and email, and returns the detail" do
    post api_v1_employees_path, params: { employee: employee_body(employee_number: " emp-10001 ", email: "Asha.Rao@Example.TEST") }, as: :json

    assert_response :created
    assert_equal "EMP-10001", json.dig("data", "employee_number")
    assert_equal "asha.rao@example.test", json.dig("data", "email")
    assert_nil json.dig("data", "current_salary")
    assert Employee.exists?(employee_number: "EMP-10001")
  end

  test "creates an employee with an initial salary in one request" do
    post api_v1_employees_path, params: { employee: employee_body(
      initial_salary: { amount: "85000.00", currency_code: "INR", effective_from: "2026-04-01" }
    ) }, as: :json

    assert_response :created
    assert_equal "85000.00", json.dig("data", "current_salary", "amount")
    assert_equal 1, Employee.find(json.dig("data", "id")).salary_records.count
  end

  test "invalid employee fields return 422 with request field names" do
    create(:employee, employee_number: "EMP-10001")

    assert_no_difference -> { Employee.count } do
      post api_v1_employees_path, params: { employee: employee_body(first_name: "", country_id: 999_999_999, hired_on: "not-a-date") }, as: :json
    end

    assert_response :unprocessable_entity
    details = json.dig("error", "details")
    assert_equal "validation_failed", json.dig("error", "code")
    assert_equal %w[country_id employee_number first_name hired_on], details.keys.sort
    assert_equal [ "has already been taken" ], details["employee_number"]
  end

  test "a duplicate email returns 422 without echoing it" do
    create(:employee, email: "taken@example.test")

    post api_v1_employees_path, params: { employee: employee_body(email: "TAKEN@example.test") }, as: :json

    assert_response :unprocessable_entity
    assert_equal({ "email" => [ "has already been taken" ] }, json.dig("error", "details"))
    assert_not_includes response.body.downcase, "taken@example.test"
  end

  # N5: a concurrent request passes the uniqueness validation and then hits the unique index. Validations
  # are skipped to reproduce that, so the real MySQL duplicate-key error is raised.
  test "losing a race to the unique index on create returns 422, not 500, and saves nothing" do
    create(:employee, employee_number: "EMP-10001")

    assert_no_difference -> { Employee.count } do
      without_employee_validations { post api_v1_employees_path, params: { employee: employee_body }, as: :json }
    end

    assert_response :unprocessable_entity
    assert_equal({ "code" => "validation_failed", "message" => "Please correct the highlighted fields.",
                   "details" => { "employee_number" => [ "has already been taken" ] } }, json["error"])
    assert_not_includes response.body, "EMP-10001", "the duplicate value is not echoed"
  end

  test "losing a race to the unique index on update returns 422 naming the field" do
    create(:employee, email: "taken@example.test")
    employee = create(:employee)

    without_employee_validations do
      patch api_v1_employee_path(employee), params: { employee: { email: "taken@example.test" } }, as: :json
    end

    assert_response :unprocessable_entity
    assert_equal({ "email" => [ "has already been taken" ] }, json.dig("error", "details"))
    assert_not_equal "taken@example.test", employee.reload.email
  end

  test "an invalid initial salary returns prefixed errors and creates nothing" do
    assert_no_difference [ -> { Employee.count }, -> { SalaryRecord.count } ] do
      post api_v1_employees_path, params: { employee: employee_body(
        hired_on: "2026-04-01", initial_salary: { amount: "0", currency_code: "XXX", effective_from: "2026-01-01" }
      ) }, as: :json
    end

    assert_response :unprocessable_entity
    assert_includes json.dig("error", "details").keys, "initial_salary.amount"
    assert_includes json.dig("error", "details").keys, "initial_salary.currency_code"
    assert_includes json.dig("error", "details").keys, "initial_salary.effective_from"
    assert_not_includes response.body, "XXX", "errors do not echo submitted values"
  end

  test "the body must be wrapped in an employee key" do
    post api_v1_employees_path, params: employee_body, as: :json

    assert_response :bad_request
    assert_equal({ "employee" => [ "is required" ] }, json.dig("error", "details"))
  end

  test "unknown body fields are ignored" do
    post api_v1_employees_path, params: { employee: employee_body(id: 42, created_at: "2000-01-01") }, as: :json

    assert_response :created
    assert_not_equal 42, json.dig("data", "id")
    assert_equal "2026-09-28T10:15:00Z", json.dig("data", "created_at")
  end

  # --- update ----------------------------------------------------------------------------------

  test "updates any subset of fields" do
    employee = create(:employee, employment_status: "active")

    patch api_v1_employee_path(employee), params: { employee: { employment_status: "terminated", department_id: departments(:legal).id } }, as: :json

    assert_response :ok
    assert_equal "terminated", json.dig("data", "employment_status")
    assert_equal "Legal", json.dig("data", "department", "name")
  end

  test "update rejects invalid values with 422" do
    employee = create(:employee)

    patch api_v1_employee_path(employee), params: { employee: { employment_status: "retired", email: "nope" } }, as: :json

    assert_response :unprocessable_entity
    assert_equal %w[email employment_status], json.dig("error", "details").keys.sort
  end

  test "moving hired_on after the first salary start is rejected (I13)" do
    employee = create(:employee, hired_on: Date.new(2021, 4, 12))
    create(:salary_record, employee: employee, effective_from: Date.new(2021, 5, 1))

    patch api_v1_employee_path(employee), params: { employee: { hired_on: "2021-06-01" } }, as: :json

    assert_response :unprocessable_entity
    assert_equal({ "hired_on" => [ "must not be after the first salary start date" ] }, json.dig("error", "details"))
  end

  test "update never touches salaries" do
    employee = create(:employee)

    patch api_v1_employee_path(employee), params: { employee: { first_name: "Asha", initial_salary: { amount: "1" } } }, as: :json

    assert_response :ok
    assert_equal 0, employee.salary_records.count
  end

  test "update of an unknown employee returns 404" do
    patch api_v1_employee_path(999_999_999), params: { employee: { first_name: "X" } }, as: :json

    assert_response :not_found
  end

  private

  def without_employee_validations
    Employee.define_method(:valid?) { |*| true }
    yield
  ensure
    Employee.remove_method(:valid?)
  end
end
