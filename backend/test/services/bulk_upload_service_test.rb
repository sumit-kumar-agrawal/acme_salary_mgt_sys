require "test_helper"

# Salary correction and scheduling rules, run through the upload as HR would.
class BulkUploadServiceTest < ActiveSupport::TestCase
  HEADER = %w[employee_number effective_from amount currency_code].freeze

  setup do
    travel_to Time.utc(2026, 9, 28, 10, 0, 0)
    @user = create(:user)
    @employee = create(:employee, employee_number: "BULK-1", hired_on: Date.new(2021, 4, 12))
    @historical = create(:salary_record, employee: @employee, amount: "80000", effective_from: Date.new(2025, 4, 1), effective_to: Date.new(2026, 3, 31))
    @current = create(:salary_record, employee: @employee, amount: "85000", effective_from: Date.new(2026, 4, 1), effective_to: Date.new(2027, 3, 31))
    @scheduled = create(:salary_record, employee: @employee, amount: "92000", effective_from: Date.new(2027, 4, 1))
  end

  def import(*rows, format: "csv")
    file = format == "csv" ? csv_upload([ HEADER, *rows ]) : xlsx_upload([ HEADER, *rows ])
    BulkUploadService.call(file: file, user: @user)
  end

  # { row_number => errors } from the failed-rows file.
  def failed_row_errors(record)
    return {} unless record.response_file.attached?

    read_result_file(record.response_file.download, "csv").drop(1).to_h { |row| [ row[4].to_i, row[5] ] }
  end

  test "corrects current and scheduled records through CorrectionService and keeps dates" do
    record = import([ "bulk-1", "2026-04-01", "86000.50", "usd" ], [ "BULK-1", "2027-04-01", "93000", "INR" ])

    assert_equal "completed", record.status
    assert_equal [ BigDecimal("86000.5"), "USD", Date.new(2027, 3, 31) ], @current.reload.values_at(:amount, :currency_code, :effective_to)
    assert_equal [ BigDecimal("93000"), "INR" ], @scheduled.reload.values_at(:amount, :currency_code)
    assert_equal 3, @employee.salary_records.count, "a correction never adds history"
  end

  test "creates scheduled records from CSV and XLSX while preserving salary history" do
    %w[csv xlsx].each_with_index do |format, index|
      date = Date.new(2028 + index, 4, 1)
      previous = @employee.salary_records.newest_first.first
      assert_difference -> { @employee.salary_records.count }, 1 do
        result = import([ "bulk-1", date.iso8601, "94000.50", "usd" ], format: format)
        assert_equal "completed", result.status
        assert_not result.response_file.attached?
      end
      scheduled = @employee.salary_records.find_by!(effective_from: date)
      assert_equal "scheduled", scheduled.status_on
      assert_equal [ BigDecimal("94000.50"), "USD", nil ], scheduled.values_at(:amount, :currency_code, :effective_to)
      assert_equal date - 1.day, previous.reload.effective_to
      assert_equal @current, @employee.current_salary
      assert_equal BigDecimal("80000"), @historical.reload.amount
    end
  end

  test "creates an employee's first salary only as a scheduled record" do
    employee = create(:employee, employee_number: "BULK-NEW")
    result = import([ employee.employee_number, Date.tomorrow.iso8601, "5000", "INR" ])

    assert_equal "completed", result.status
    assert_equal "scheduled", employee.salary_records.sole.status_on
    assert_nil employee.current_salary
  end

  test "rejects missing records starting today or in the past without changing history" do
    result = nil
    assert_no_difference -> { SalaryRecord.count } do
      result = import([ "BULK-1", Date.current.iso8601, "1", "INR" ],
        [ "BULK-1", Date.yesterday.iso8601, "1", "INR" ])
    end
    assert_equal "completed_with_errors", result.status
    assert_equal({ 2 => "effective_from: a new salary record must start in the future",
                   3 => "effective_from: a new salary record must start in the future" }, failed_row_errors(result))
    assert_nil @scheduled.reload.effective_to
  end

  test "rejects a new future record before the latest scheduled record" do
    result = nil
    assert_no_difference -> { SalaryRecord.count } do
      result = import([ "BULK-1", "2027-01-01", "94000", "INR" ])
    end
    assert_equal "effective_from: must be after the latest salary record's start date", failed_row_errors(result)[2]
    assert_equal Date.new(2027, 3, 31), @current.reload.effective_to
    assert_nil @scheduled.reload.effective_to
  end

  test "scheduled creation rechecks the latest record after preloading" do
    service = BulkUploadService.new(file: nil, user: @user)
    values = { employee_number: "BULK-1", effective_from: "2028-04-01", amount: "94000", currency_code: "INR" }
    context = service.preload([ values ])
    latest = Salaries::ChangeService.call(employee: @employee,
      attributes: { effective_from: "2029-04-01", amount: "96000", currency_code: "INR" })
    assert latest.persisted?
    assert_no_difference -> { SalaryRecord.count } do
      assert_equal [ "effective_from: must be after the latest salary record's start date" ], service.process_row(values, context)
    end
    assert_nil latest.reload.effective_to
  end

  test "new scheduled rows keep hire date and money validations and leave history untouched on failure" do
    employee = create(:employee, employee_number: "FUTURE-HIRE", hired_on: Date.new(2028, 6, 1))
    result = nil
    assert_no_difference -> { SalaryRecord.count } do
      result = import([ "BULK-1", "2028-04-01", "1.123", "INR" ],
        [ "BULK-1", "2028-05-01", "0", "INR" ],
        [ "BULK-1", "2028-06-01", "1", "XXX" ],
        [ employee.employee_number, "2028-04-01", "1", "INR" ])
    end
    assert_equal "completed_with_errors", result.status
    assert_equal({ 2 => "amount: must have at most 2 decimal places for this currency",
                   3 => "amount: must be a number greater than 0 without separators, e.g. 85000.00",
                   4 => "currency_code: is not a supported currency",
                   5 => "effective_from: must not be before the employee's hire date" }, failed_row_errors(result))
    assert_nil @scheduled.reload.effective_to
  end

  test "mixes corrections and multiple scheduled creations while reporting duplicate new targets" do
    result = import([ "BULK-1", "2026-04-01", "86000", "INR" ],
      [ "BULK-1", "2028-04-01", "94000", "INR" ],
      [ "BULK-1", "2029-04-01", "96000", "INR" ],
      [ "BULK-1", "2030-04-01", "97000", "INR" ],
      [ "BULK-1", "2030-04-01", "98000", "INR" ])
    assert_equal "completed_with_errors", result.status
    assert_equal BigDecimal("86000"), @current.reload.amount
    assert_equal 5, @employee.salary_records.count
    assert_equal Date.new(2028, 3, 31), @scheduled.reload.effective_to
    assert_equal Date.new(2029, 3, 31), @employee.salary_records.find_by!(effective_from: "2028-04-01").effective_to
    assert_equal [ 5, 6 ], failed_row_errors(result).keys
    assert_equal "The same salary record also appears in row 6", failed_row_errors(result)[5]
    assert_equal "The same salary record also appears in row 5", failed_row_errors(result)[6]
  end

  test "reads XLSX dates and numbers" do
    record = import([ "BULK-1", Date.new(2026, 4, 1), 86000.25, "INR" ], format: "xlsx")

    assert_equal "completed", record.status
    assert_equal BigDecimal("86000.25"), @current.reload.amount
  end

  test "a matching row completes without changing its timestamp" do
    record = import([ "BULK-1", "2026-04-01", "85000.00", "INR" ])

    assert_equal "completed", record.status
    assert_equal @current.updated_at, @current.reload.updated_at
  end

  test "reports every problem in a row without echoing values, and applies the valid rows" do
    create(:employee, employee_number: "BULK-2")
    record = import(
      [ "BULK-1", "2026-04-01", "86000", "INR" ],
      [ "NOPE-1", "01/04/2026", "85,000", "XXX" ],
      [ "BULK-1", "2025-04-01", "81000", "INR" ],
      [ "BULK-1", "2026-05-01", "0", "INR" ],
      [ "BULK-1", "2027-04-01", "1.123", "INR" ],
      [ "BULK-2", "2026-04-01", "1", "JPY" ],
      [ "BULK-2", "2027-04-01", "", "INR" ],
      [ "BULK-1", "2026-04-01", "99999999999999", "INR" ]
    )

    assert_equal "completed_with_errors", record.status
    assert_equal({
      2 => "The same salary record also appears in row 9",
      3 => "employee_number: no employee has this number; effective_from: must be a date in YYYY-MM-DD format; " \
           "amount: must be a number greater than 0 without separators, e.g. 85000.00; currency_code: is not a supported currency",
      4 => "effective_from: historical salary records cannot be changed",
      5 => "amount: must be a number greater than 0 without separators, e.g. 85000.00; " \
           "effective_from: a new salary record must start in the future",
      6 => "amount: must have at most 2 decimal places for this currency",
      7 => "effective_from: a new salary record must start in the future",
      8 => "amount: is required",
      9 => "The same salary record also appears in row 2"
    }, failed_row_errors(record))
    assert_equal BigDecimal("85000"), @current.reload.amount
    assert_equal BigDecimal("80000"), @historical.reload.amount
  end

  test "a record that became historical after preloading fails at process time" do
    service = BulkUploadService.new(file: nil, user: @user)
    row = HEADER.zip([ "BULK-1", "2026-04-01", "86000", "INR" ]).to_h
    row = BulkUploadService::MAPPER.transform_values { |mapper| mapper.call(row) }
    context = service.preload([ row ])

    travel_to Time.utc(2027, 4, 2)
    outcome = service.process_row(row, context)

    assert_equal [ "effective_from: historical salary records cannot be changed" ], outcome
    assert_equal BigDecimal("85000"), @current.reload.amount
  end

  test "preloads employees, records, and currencies in a fixed number of queries" do
    service = BulkUploadService.new(file: nil, user: @user)
    rows = Array.new(20) do
      employee = create(:employee)
      create(:salary_record, employee: employee)
      HEADER.zip([ employee.employee_number, "2026-04-01", "1", "INR" ]).to_h
    end
    rows = rows.map { |row| BulkUploadService::MAPPER.transform_values { |mapper| mapper.call(row) } }
    queries = 0
    counter = ->(*, payload) { queries += 1 unless payload[:name].in?([ "SCHEMA", "TRANSACTION" ]) || payload[:cached] }

    context = ActiveSupport::Notifications.subscribed(counter, "sql.active_record") { service.preload(rows) }
    assert_equal 20, context[:employees].size

    assert_equal 3, queries
  end

  test "a stale matching snapshot does not skip a correction" do
    service = BulkUploadService.new(file: nil, user: @user)
    row = HEADER.zip([ "BULK-1", "2026-04-01", "85000", "INR" ]).to_h
    row = BulkUploadService::MAPPER.transform_values { |mapper| mapper.call(row) }
    context = service.preload([ row ])
    SalaryRecord.where(id: @current.id).update_all(amount: "87000")

    outcome = service.process_row(row, context)

    assert_empty outcome
    assert_equal BigDecimal("85000"), @current.reload.amount
  end

  test "a freshly loaded matching record is unchanged despite a stale differing snapshot" do
    service = BulkUploadService.new(file: nil, user: @user)
    row = HEADER.zip([ "BULK-1", "2026-04-01", "86000", "INR" ]).to_h
    row = BulkUploadService::MAPPER.transform_values { |mapper| mapper.call(row) }
    context = service.preload([ row ])
    SalaryRecord.where(id: @current.id).update_all(amount: "86000")

    assert_empty service.process_row(row, context)
  end

  test "an unchanged snapshot still checks editability under the service lock" do
    service = BulkUploadService.new(file: nil, user: @user)
    row = HEADER.zip([ "BULK-1", "2026-04-01", "85000", "INR" ]).to_h
    row = BulkUploadService::MAPPER.transform_values { |mapper| mapper.call(row) }
    context = service.preload([ row ])
    SalaryRecord.where(id: @current.id).update_all(effective_to: Date.yesterday)

    outcome = service.process_row(row, context)

    assert_equal [ "Historical salary records cannot be changed" ], outcome
  end
  test "accepts BOM, reordered normalized headers, blank rows, and retry metadata" do
    file = csv_upload(nil, content: "﻿Amount,Employee Number,Effective-From,Currency Code,row_number,errors\n86000,bulk-1,2026-04-01,inr,99,old\n,,,,,\n0,bulk-1,2027-04-01,inr,100,old\n")
    record = BulkUploadService.call(file: file, user: @user)
    assert_equal "completed_with_errors", record.status
    assert_equal BigDecimal("86000"), @current.reload.amount
    errors = failed_row_errors(record)
    assert_equal [ 4 ], errors.keys
    assert_match(/amount:/, errors[4])
  end

  test "rejects malformed, unsupported, oversized and empty files without history" do
    files = [
      csv_upload([ HEADER ], filename: "upload.xls"),
      csv_upload([ HEADER, %w[a b] ], filename: "upload.xlsx"),
      uploaded_file("PK\x03\x04garbage".b, "upload.xlsx"),
      uploaded_file("employee_number\n\xFF\xFE\n".b, "upload.csv"),
      uploaded_file("a,\"b\n", "upload.csv"),
      csv_upload(nil, content: "a" * (BulkUploadService::MAX_BYTES + 1)),
      csv_upload(nil, content: "\n\n"),
      csv_upload([ HEADER ])
    ]
    files.each do |file|
      assert_no_difference -> { BulkSalaryCorrection.count } do
        assert_raises(BulkUploadService::InvalidFileError) { BulkUploadService.call(file: file, user: @user) }
      end
    end
  end

  test "row limit rejects the whole upload before creating history" do
    file = csv_upload([ HEADER, [ "BULK-1", "2026-04-01", "86000", "INR" ], [ "BULK-1", "2027-04-01", "93000", "INR" ] ])
    assert_no_difference -> { BulkSalaryCorrection.count } do
      error = assert_raises(BulkUploadService::InvalidFileError) { BulkUploadService.call(file: file, user: @user, max_rows: 1) }
      assert_equal "The file has more than 1 data rows.", error.message
    end
  end

  test "duplicate and unknown headers are rejected with safe details" do
    error = assert_raises(BulkUploadService::HeaderMismatchError) do
      BulkUploadService.call(file: csv_upload([ HEADER + %w[Amount secret], [ "BULK-1", "2026-04-01", "86000", "INR", "1", "hidden" ] ]), user: @user)
    end
    assert_equal({ "duplicate_columns" => [ "amount" ], "unknown_columns" => [ "secret" ] }, error.details)
  end

  test "response CSV neutralizes spreadsheet formulas without changing the original file" do
    file = csv_upload([ HEADER, [ "=HYPERLINK(1)", "2026-04-01", "-5", "INR" ] ])
    record = BulkUploadService.call(file: file, user: @user)
    cells = read_result_file(record.response_file.download, "csv").last
    assert_equal "'=HYPERLINK(1)", cells[0]
    assert_equal "'-5", cells[2]
    assert_equal file.tap(&:rewind).read, record.original_file.download
  end

  # Reuse still requires no helper framework: override the module mapping and row method.
  class EmployeeUpload < BulkUploadService
    REQUIRED_HEADERS = %w[number first_name last_name country_id department_id employment_status].freeze
    OPTIONAL_HEADERS = %w[email].freeze
    MAPPER = {
      employee_number: ->(row) { row["number"].to_s.upcase },
      first_name: ->(row) { row["first_name"] }, last_name: ->(row) { row["last_name"] },
      country_id: ->(row) { row["country_id"] }, department_id: ->(row) { row["department_id"] },
      employment_status: ->(row) { row["employment_status"] }, email: ->(row) { row["email"] }
    }.freeze
    def preload(_rows) = nil
    def duplicate_key(values) = values[:employee_number]
    def duplicate_description = "The same employee"
    def process_row(values, _context)
      employee = Employees::CreateService.call(attributes: values)
      employee.errors.map { |error| "#{error.attribute}: #{error.message}" }
    end
  end

  test "the same single service supports another module with optional and renamed headers" do
    country = Country.find_by!(code: "IN").id
    department = Department.find_by!(name: "Engineering").id
    file = xlsx_upload([ EmployeeUpload::REQUIRED_HEADERS,
      [ "upload-1", "Synthetic", "Employee", country, department, "active" ],
      [ "upload-2", "", "Employee", country, department, "active" ] ])
    record = EmployeeUpload.call(file: file, user: @user)
    assert_equal "completed_with_errors", record.status
    assert_nil Employee.find_by!(employee_number: "UPLOAD-1").email
    assert_not Employee.exists?(employee_number: "UPLOAD-2")
    csv = read_result_file(record.response_file.download, "csv")
    assert_equal EmployeeUpload::REQUIRED_HEADERS + %w[email row_number errors], csv.first
    assert_equal "upload-2", csv.last.first
  end
end
