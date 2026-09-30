require "csv"

# One upload flow: parse, check headers, map/validate/save rows, and attach a response CSV.
# Salary defaults live here. A future module can subclass and override the headers, mapper,
# preload, duplicate_key/description, and process_row (returns [] on success or safe errors).
class BulkUploadService
  class InvalidFileError < StandardError; end

  class HeaderMismatchError < InvalidFileError
    attr_reader :details

    def initialize(details)
      @details = details.reject { |_, values| values.empty? }
      super("The file header does not match the template.")
    end
  end

  FORMATS = { ".csv" => "csv", ".xlsx" => "xlsx" }.freeze
  CONTENT_TYPES = {
    "csv" => "text/csv",
    "xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  }.freeze
  MAX_BYTES = 2.megabytes
  MAX_UNPACKED_BYTES = 50.megabytes
  ZIP_SIGNATURE = "PK\x03\x04".b.freeze
  BOM = "﻿".freeze
  EXTRA_COLUMNS = %w[row_number errors].freeze
  FORMULA_TRIGGERS = [ "=", "+", "-", "@", "\t", "\r" ].freeze

  REQUIRED_HEADERS = %w[employee_number effective_from amount currency_code].freeze
  DATE_FORMAT = /\A\d{4}-\d{2}-\d{2}\z/
  AMOUNT_FORMAT = /\A\d+(\.\d+)?\z/
  # salary_records.amount is DECIMAL(18,4).
  MAX_AMOUNT = BigDecimal("1e14")
  ERROR_COLUMNS = { currency: "currency_code" }.freeze

  OPTIONAL_HEADERS = [].freeze
  FILE_PREFIX = "salary-corrections"
  SALARY_MAPPER = {
    employee_number: ->(row) { row["employee_number"].to_s.strip.upcase },
    amount: ->(row) { row["amount"] },
    effective_from: ->(row) { row["effective_from"] },
    currency_code: ->(row) { row["currency_code"].to_s.strip.upcase }
  }.freeze
  MAPPER = SALARY_MAPPER

  def self.call(file:, user:, record_class: BulkSalaryCorrection, max_rows: 2_000)
    new(file: file, user: user, record_class: record_class, max_rows: max_rows).call
  end

  def initialize(file:, user:, record_class: BulkSalaryCorrection, max_rows: 2_000)
    @file = file
    @user = user
    @record_class = record_class
    @max_rows = max_rows
    @failed = []
    @processed = 0
  end

  def call
    parsed = parse_file
    header = validate_header(parsed[:header])
    @rows = parsed[:rows].map do |raw|
      values = header.each_with_index.filter_map do |name, index|
        [ name, raw[:cells][index].to_s.strip ] if columns.include?(name)
      end.to_h
      { number: raw[:number], values: values,
        attributes: self.class::MAPPER.transform_values { |mapper| mapper.call(values) } }
    end

    @import = @record_class.new(user: @user, status: "process", file_format: parsed[:format],
                                original_filename: parsed[:filename].truncate(255), started_at: Time.current,
                                original_file: { io: StringIO.new(parsed[:content]), filename: parsed[:filename],
                                                 content_type: CONTENT_TYPES.fetch(parsed[:format]) })
    @import.save!
    context = preload(@rows.map { |row| row[:attributes] })
    duplicates = @rows.group_by { |row| duplicate_key(row[:attributes]) }.except(nil)

    @rows.each do |row|
      others = duplicates.fetch(duplicate_key(row[:attributes]), []).reject { |other| other[:number] == row[:number] }
      errors = if others.any?
                 [ "#{duplicate_description} also appears in #{'row'.pluralize(others.size)} #{others.map { |other| other[:number] }.join(', ')}" ]
      else
                 process_row(row[:attributes], context)
      end
      @failed << [ row, errors ] if errors.any?
      @processed += 1
    end
    finish_import
    @import
  rescue StandardError
    if @import&.persisted?
      @rows.drop(@processed).each do |row|
        @failed << [ row, [ "Processing stopped. Review current records before retrying this row." ] ]
      end
      begin
        finish_import(with_error: true)
      rescue StandardError => error
        # Storage can fail too. Preserve the original error without logging submitted values.
        @import.update_columns(status: "completed_with_errors", finished_at: Time.current, updated_at: Time.current)
        Rails.logger.error("Bulk upload #{@import.id} response could not be saved: #{error.class}")
      end
    end
    raise
  end

  def self.template(format:)
    headers = self::REQUIRED_HEADERS + self::OPTIONAL_HEADERS
    content = if format == "xlsx"
                package = Axlsx::Package.new
                package.workbook.add_worksheet(name: "Rows") { |sheet| sheet.add_row headers, types: Array.new(headers.size, :string) }
                package.to_stream.read
    else
                csv_content(headers, [])
    end
    { io: StringIO.new(content), filename: "#{self::FILE_PREFIX}-template.#{format}", content_type: CONTENT_TYPES.fetch(format) }
  end

  def self.csv_content(headers, rows)
    BOM + CSV.generate do |csv|
      csv << headers
      rows.each do |cells|
        csv << cells.map { |cell| cell.to_s.start_with?(*FORMULA_TRIGGERS) ? "'#{cell}" : cell.to_s }
      end
    end
  end

  # Batched employee lookups, then salary records and currencies for the whole file.
  def preload(rows)
    numbers = rows.map { |row| row[:employee_number] }.uniq
    employees = numbers.each_slice(1_000).flat_map { |slice| Employee.where(employee_number: slice).to_a }
                       .index_by(&:employee_number)
    records = SalaryRecord.where(employee_id: employees.values.map(&:id)).to_a
                          .index_by { |record| [ record.employee_id, record.effective_from ] }
    { employees: employees, records: records, currencies: Currency.all.index_by(&:code) }
  end

  def duplicate_key(values)
    return if REQUIRED_HEADERS.any? { |header| values[header.to_sym].blank? }

    [ values[:employee_number], values[:effective_from] ]
  end

  def duplicate_description
    "The same salary record"
  end

  def process_row(values, context)
    missing = REQUIRED_HEADERS.select { |header| values[header.to_sym].blank? }
    return missing.map { |header| "#{header}: is required" } if missing.any?

    employee = context[:employees][values[:employee_number]]
    date = parse_date(values[:effective_from])
    amount = parse_amount(values[:amount])
    currency = context[:currencies][values[:currency_code]]

    errors = []
    errors << "employee_number: no employee has this number" unless employee
    errors << "effective_from: must be a date in YYYY-MM-DD format" unless date
    errors.concat(amount_errors(amount, currency))
    errors << "currency_code: is not a supported currency" unless currency
    record = context[:records][[ employee.id, date ]] if employee && date
    if employee && date
      if record && !record.editable?
        errors << "effective_from: historical salary records cannot be changed"
      elsif !record && date <= Date.current
        errors << "effective_from: a new salary record must start in the future"
      end
    end
    return errors if errors.any?

    attributes = { amount: values[:amount], currency_code: values[:currency_code] }
    record = if record
      Salaries::CorrectionService.call(record: record, attributes: attributes)
    else
      Salaries::ChangeService.call(employee: employee, attributes: attributes.merge(effective_from: date))
    end
    return error_messages(record.errors) if record.errors.any?

    []
  end

  private

  def parse_date(value)
    Date.iso8601(value) if DATE_FORMAT.match?(value)
  rescue Date::Error
    nil
  end

  def parse_amount(value)
    BigDecimal(value) if AMOUNT_FORMAT.match?(value)
  end

  # Same rules as SalaryRecord (amount > 0, I5/J9 minor units), checked here so every problem in a
  # row is reported together.
  def amount_errors(amount, currency)
    return [ "amount: must be a number greater than 0 without separators, e.g. 85000.00" ] if amount.nil? || amount.zero?
    return [ "amount: is too large" ] if amount >= MAX_AMOUNT
    return [] if currency.nil? || amount.round(currency.minor_units) == amount

    [ "amount: must have at most #{currency.minor_units} decimal places for this currency" ]
  end

  # Errors from the domain services, e.g. history changed after the file was checked.
  def error_messages(errors)
    errors.map do |error|
      next error.message if error.attribute == :base

      "#{ERROR_COLUMNS.fetch(error.attribute, error.attribute)}: #{error.message}"
    end
  end

  def columns
    self.class::REQUIRED_HEADERS + self.class::OPTIONAL_HEADERS
  end

  def finish_import(with_error: false)
    if @failed.any?
      rows = @failed.map do |row, errors|
        columns.map { |column| row[:values][column] } + [ row[:number], errors.join("; ") ]
      end
      @import.response_file.attach(io: StringIO.new(self.class.csv_content(columns + EXTRA_COLUMNS, rows)),
                                   filename: "#{File.basename(@import.original_filename, '.*')}-response.csv", content_type: "text/csv")
    end
    @import.update!(status: with_error || @failed.any? ? "completed_with_errors" : "completed", finished_at: Time.current)
  end

  def validate_header(header)
    names = header.map { |name| name.to_s.strip.downcase.gsub(/[\s-]+/, "_") }
    names.pop while names.last&.empty?
    labels = names.map { |name| name.empty? ? "(blank)" : name }
    details = {
      "missing_columns" => self.class::REQUIRED_HEADERS - names,
      "unknown_columns" => labels.uniq - columns - EXTRA_COLUMNS,
      "duplicate_columns" => labels.tally.select { |_, count| count > 1 }.keys
    }
    raise HeaderMismatchError.new(details) if details.values.any?(&:present?)

    names
  end

  def parse_file
    filename = File.basename(@file.original_filename.to_s)
    format = FORMATS[File.extname(filename).downcase]
    raise InvalidFileError, "Upload a .csv or .xlsx file." unless format
    raise InvalidFileError, "The file must be at most #{MAX_BYTES / 1.megabyte} MB." if @file.size > MAX_BYTES

    content = File.binread(@file.path)
    table = format == "csv" ? read_csv(content) : read_xlsx(content)
    header, *rows = table.each_with_index.map { |cells, index| { number: index + 1, cells: cells } }
                         .reject { |row| row[:cells].all?(&:blank?) }
    raise InvalidFileError, "The file is empty." unless header
    raise InvalidFileError, "The file has no data rows." if rows.empty?
    raise InvalidFileError, "The file has more than #{@max_rows.to_fs(:delimited)} data rows." if rows.size > @max_rows

    { format: format, filename: filename, content: content, header: header[:cells], rows: rows }
  end

  def read_csv(content)
    text = content.dup.force_encoding(Encoding::UTF_8).delete_prefix(BOM)
    raise InvalidFileError, "The CSV file must be UTF-8 text." unless text.valid_encoding? && !text.include?("\0")

    CSV.parse(text).map { |cells| cells.map { |cell| cell.to_s.strip } }
  rescue CSV::MalformedCSVError
    raise InvalidFileError, "The CSV file could not be read."
  end

  def read_xlsx(content)
    raise InvalidFileError, "The file is not a valid .xlsx file." unless content.start_with?(ZIP_SIGNATURE)

    check_unpacked_size
    sheet = Roo::Excelx.new(@file.path, file_warning: :ignore).sheet(0)
    return [] unless sheet.first_row

    (1..sheet.last_row).map { |index| sheet.row(index).map { |cell| cell_to_s(cell) } }
  rescue Zip::Error, Nokogiri::XML::SyntaxError, ArgumentError, IOError
    raise InvalidFileError, "The file is not a valid .xlsx file."
  end

  # A small archive can unpack to gigabytes; refuse before Roo parses the XML.
  def check_unpacked_size
    unpacked = Zip::File.open(@file.path) { |zip| zip.entries.sum(&:size) }
    raise InvalidFileError, "The .xlsx file is too large once unpacked." if unpacked > MAX_UNPACKED_BYTES
  end

  def cell_to_s(cell)
    case cell
    when nil then ""
    when Date, Time, DateTime then cell.to_date.iso8601
    when Float then cell == cell.truncate ? cell.to_i.to_s : cell.to_s
    else cell.to_s.strip
    end
  end
end
