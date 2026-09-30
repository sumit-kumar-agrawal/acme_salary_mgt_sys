require "test_helper"

# /api/v1/bulk_salary_corrections: upload, history, and file downloads.
class Api::V1::BulkSalaryCorrectionsTest < ActionDispatch::IntegrationTest
  HEADER = %w[employee_number effective_from amount currency_code].freeze
  IMPORT_KEYS = %w[id status file_format original_filename
                   original_file_path response_file_path started_at finished_at created_at].freeze

  setup do
    travel_to Time.utc(2026, 9, 28, 10, 15, 0)
    sign_in
    @employee = create(:employee, employee_number: "BULK-1", hired_on: Date.new(2021, 4, 12))
    @current = create(:salary_record, employee: @employee, amount: "85000", effective_from: Date.new(2026, 4, 1))
  end

  def upload(file)
    post api_v1_bulk_salary_corrections_path, params: { file: file }
  end

  test "every action requires sign-in" do
    delete api_v1_session_path

    upload(csv_upload([ HEADER, [ "BULK-1", "2026-04-01", "86000", "INR" ] ]))
    assert_response :unauthorized
    [ api_v1_bulk_salary_corrections_path, template_api_v1_bulk_salary_corrections_path ].each do |url|
      get url
      assert_response :unauthorized, url
    end
    assert_equal 85000, @current.reload.amount
  end

  test "an upload where every row succeeds returns 201 without a failed-rows file" do
    upload(csv_upload([ HEADER, [ "BULK-1", "2026-04-01", "86000.00", "INR" ] ], filename: "june.csv"))

    assert_response :created
    data = json["data"]
    assert_equal IMPORT_KEYS, data.keys
    assert_equal [ "completed", "csv", "june.csv" ],
      data.values_at("status", "file_format", "original_filename")
    assert_equal "/api/v1/bulk_salary_corrections/#{data['id']}/original_file", data["original_file_path"]
    assert_nil data["response_file_path"]
    assert_equal 86000, @current.reload.amount
  end

  test "an upload with failed rows applies the rest and links a downloadable file of the failed rows" do
    upload(xlsx_upload([ HEADER, [ "BULK-1", "2026-04-01", "86000", "INR" ], [ "NOPE", "2026-04-01", "1", "INR" ] ], filename: "june.xlsx"))

    assert_response :created
    data = json["data"]
    assert_equal "completed_with_errors", data["status"]
    assert_equal "xlsx", data["file_format"], "history retains the original upload format"
    assert_no_match(/NOPE|86000/, response.body, "row values are never returned as JSON")

    get data["response_file_path"]
    assert_response :ok
    assert_equal BulkUploadService::CONTENT_TYPES["csv"], response.media_type
    assert_match(/attachment; filename="june-response.csv"/, response.headers["Content-Disposition"])
    assert_equal "no-store", response.headers["Cache-Control"]
    assert_equal [ HEADER + %w[row_number errors], [ "NOPE", "2026-04-01", "1", "INR", "3", "employee_number: no employee has this number" ] ],
      read_result_file(response.body, "csv")

    corrected_rows = read_result_file(response.body, "csv")
    corrected_rows.last[0] = "BULK-1"
    corrected_rows.last[2] = "87000"
    upload(csv_upload(corrected_rows, filename: "june-response.csv"))
    assert_response :created
    assert_equal "completed", json.dig("data", "status")
    assert_equal 87000, @current.reload.amount

    get data["original_file_path"]
    assert_response :ok
    assert_match(/filename="june.xlsx"/, response.headers["Content-Disposition"])
    assert_equal "no-store", response.headers["Cache-Control"]
  end

  test "creates scheduled salary records alongside corrections and writes rejected creations to CSV" do
    assert_difference -> { @employee.salary_records.count }, 1 do
      upload(csv_upload([ HEADER,
        [ "BULK-1", "2026-04-01", "86000", "INR" ],
        [ "BULK-1", "2027-04-01", "92000", "USD" ],
        [ "BULK-1", "2026-09-28", "90000", "INR" ] ]))
    end
    assert_response :created
    assert_equal IMPORT_KEYS, json["data"].keys
    assert_equal "completed_with_errors", json.dig("data", "status")
    assert_equal BigDecimal("86000"), @current.reload.amount
    assert_equal Date.new(2027, 3, 31), @current.effective_to
    scheduled = @employee.salary_records.find_by!(effective_from: "2027-04-01")
    assert_equal [ "scheduled", "USD", BigDecimal("92000") ], [ scheduled.status_on, scheduled.currency_code, scheduled.amount ]
    assert_equal @current, @employee.current_salary

    get json.dig("data", "response_file_path")
    assert_response :ok
    rows = read_result_file(response.body, "csv")
    assert_equal 2, rows.size
    assert_equal [ "BULK-1", "2026-09-28", "90000", "INR", "4",
      "effective_from: a new salary record must start in the future" ], rows.last
  end

  test "a header mismatch is rejected before processing and leaves no history" do
    assert_no_difference -> { BulkSalaryCorrection.count } do
      upload(csv_upload([ %w[employee_number amount salary], [ "BULK-1", "86000", "x" ] ]))
    end

    assert_response :unprocessable_entity
    assert_equal({ "code" => "invalid_file_header", "message" => "The file header does not match the template.",
                   "details" => { "missing_columns" => %w[effective_from currency_code], "unknown_columns" => %w[salary] } },
      json["error"])
    assert_equal 85000, @current.reload.amount
  end

  test "an unreadable file is rejected with invalid_file" do
    assert_no_difference -> { BulkSalaryCorrection.count } do
      upload(csv_upload([ HEADER ], filename: "june.pdf"))
    end

    assert_response :unprocessable_entity
    assert_equal [ "invalid_file", "Upload a .csv or .xlsx file." ], json["error"].values_at("code", "message")
  end

  test "a missing or non-file parameter is a bad request" do
    post api_v1_bulk_salary_corrections_path
    assert_response :bad_request
    assert_equal({ "file" => [ "is required" ] }, json.dig("error", "details"))

    post api_v1_bulk_salary_corrections_path, params: { file: "text" }
    assert_response :bad_request
    assert_equal({ "file" => [ "must be an uploaded file" ] }, json.dig("error", "details"))
  end

  test "history is paginated newest first and show returns one import" do
    3.times { |i| upload(csv_upload([ HEADER, [ "BULK-1", "2026-04-01", (86000 + i).to_s, "INR" ] ], filename: "u#{i}.csv")) }

    get api_v1_bulk_salary_corrections_path, params: { per_page: 2 }

    assert_response :ok
    assert_equal %w[u2.csv u1.csv], json["data"].map { |i| i["original_filename"] }
    assert_equal({ "page" => 1, "per_page" => 2, "total_count" => 3, "total_pages" => 2 }, json["meta"])

    get api_v1_bulk_salary_correction_path(json["data"].first["id"])
    assert_response :ok
    assert_equal "u2.csv", json.dig("data", "original_filename")
  end

  test "the history query count does not grow with the number of imports (no N+1)" do
    # Compare histories that both have files, so a fixed blob preload is included in both counts.
    upload(csv_upload([ HEADER, [ "BULK-1", "2026-04-01", "1", "XXX" ] ]))
    few = count_queries { get api_v1_bulk_salary_corrections_path }
    3.times { upload(csv_upload([ HEADER, [ "BULK-1", "2026-04-01", "1", "XXX" ] ])) }
    many = count_queries { get api_v1_bulk_salary_corrections_path }

    assert_equal 4, json["data"].size
    assert_equal few, many
  end

  test "unknown imports and a missing failed-rows file return 404" do
    upload(csv_upload([ HEADER, [ "BULK-1", "2026-04-01", "86000", "INR" ] ]))
    id = json.dig("data", "id")

    [ api_v1_bulk_salary_correction_path(999_999_999), original_file_api_v1_bulk_salary_correction_path(999_999_999),
      response_file_api_v1_bulk_salary_correction_path(id) ].each do |url|
      get url
      assert_response :not_found, url
      assert_equal "not_found", json.dig("error", "code")
    end
  end

  test "the template downloads the header row as CSV by default or as XLSX" do
    get template_api_v1_bulk_salary_corrections_path

    assert_response :ok
    assert_equal "text/csv", response.media_type
    assert_match(/filename="salary-corrections-template.csv"/, response.headers["Content-Disposition"])
    assert_equal [ HEADER ], read_result_file(response.body, "csv")

    get template_api_v1_bulk_salary_corrections_path, params: { file_format: "xlsx" }
    assert_equal [ HEADER ], read_result_file(response.body, "xlsx")

    get template_api_v1_bulk_salary_corrections_path, params: { file_format: "xls" }
    assert_response :bad_request
  end

  test "an unexpected processing error returns generic 500 and history shows committed rows" do
    @current.update!(effective_to: Date.new(2027, 3, 31))
    create(:salary_record, employee: @employee, amount: "92000", effective_from: Date.new(2027, 4, 1))
    service_class = BulkUploadService
    original = service_class.instance_method(:process_row)
    original_rescue_setting = Rails.configuration.x.api_rescue_unexpected_errors
    Rails.configuration.x.api_rescue_unexpected_errors = true
    service_class.define_method(:process_row) do |values, context|
      raise "private salary value" if values[:amount] == "999"

      original.bind_call(self, values, context)
    end

    upload(csv_upload([ HEADER, [ "NOPE", "2026-04-01", "1", "INR" ],
      [ "BULK-1", "2026-04-01", "86000", "INR" ], [ "BULK-1", "2027-04-01", "999", "INR" ] ]))

    assert_response :internal_server_error
    assert_equal({ "code" => "internal_error", "message" => "Something went wrong." }, json["error"])
    assert_equal 86000, @current.reload.amount, "successful row transactions remain committed"
    get api_v1_bulk_salary_correction_path(BulkSalaryCorrection.last.id)
    assert_response :ok
    assert_equal "completed_with_errors", json.dig("data", "status")
    assert_not_nil json.dig("data", "response_file_path")
    assert_not_nil json.dig("data", "finished_at")
  ensure
    service_class.define_method(:process_row, original) if original
    Rails.configuration.x.api_rescue_unexpected_errors = original_rescue_setting
  end
end
