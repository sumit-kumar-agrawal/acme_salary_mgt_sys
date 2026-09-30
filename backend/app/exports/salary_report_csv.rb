require "csv"

# CSV form of the salary report (docs/api-specification.md §9.2, D24, BACKEND_PLAN.md M15/M16).
# Takes the same SalaryReportQuery relation as the JSON report, so rows and order match it.
#
# - One query: allowlisted columns are plucked in report order with LIMIT cap + 1. A larger result raises
#   TooLarge instead of being truncated. About 40k rows fit comfortably in memory, so nothing is streamed.
# - Fixed column allowlist, no email (D18). Amounts are monthly, rounded to the currency's minor units.
# - Text cells starting with = + - @ tab or CR are prefixed with ' so spreadsheets do not run them as formulas.
# - A UTF-8 byte-order mark lets Excel show accented names correctly.
class SalaryReportCsv
  include Api::FormattingHelper

  class TooLarge < StandardError; end

  MAX_ROWS = 40_000
  BOM = "﻿".freeze
  HEADERS = %w[employee_number first_name last_name country_code country_name department employment_status
               monthly_amount currency_code effective_from].freeze
  COLUMNS = %w[employees.employee_number employees.first_name employees.last_name countries.code countries.name
               departments.name employees.employment_status salary_records.amount currencies.minor_units
               salary_records.currency_code salary_records.effective_from].freeze
  FORMULA_TRIGGERS = [ "=", "+", "-", "@", "\t", "\r" ].freeze

  # Read through a method so tests can lower the cap without inserting 10,001 rows.
  def self.max_rows
    MAX_ROWS
  end

  def initialize(report)
    @report = report
  end

  def generate
    rows = @report.joins(:currency, employee: %i[country department])
      .limit(self.class.max_rows + 1).pluck(*COLUMNS.map { |column| Arel.sql(column) })
    raise TooLarge if rows.size > self.class.max_rows

    BOM + CSV.generate do |csv|
      csv << HEADERS
      rows.each { |row| csv << format_row(*row) }
    end
  end

  private

  def format_row(number, first_name, last_name, country_code, country_name, department, status, amount, minor_units,
                 currency_code, effective_from)
    [ number, first_name, last_name, country_code, country_name, department, status, money(amount, minor_units),
      currency_code, effective_from.iso8601 ].map { |cell| neutralise_formula(cell) }
  end

  def neutralise_formula(cell)
    cell.start_with?(*FORMULA_TRIGGERS) ? "'#{cell}" : cell
  end
end
