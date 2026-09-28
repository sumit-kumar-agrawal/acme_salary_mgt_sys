require "test_helper"

class Demo::IntegrityCheckTest < ActiveSupport::TestCase
  setup { @employee = create(:employee, hired_on: Date.new(2021, 4, 12)) }

  test "reports zero violations for a valid history" do
    Salaries::ChangeService.call(employee: @employee, attributes: { amount: "85000", currency_code: "INR", effective_from: "2025-01-01" })
    Salaries::ChangeService.call(employee: @employee, attributes: { amount: "90000", currency_code: "INR", effective_from: "2026-01-01" })

    assert Demo::IntegrityCheck.new.clean?
  end

  # Each check must detect bad rows that bypass validations (insert_all! skips them).
  test "detects overlapping periods" do
    insert_salary(effective_from: "2025-01-01", effective_to: "2025-12-31")
    insert_salary(effective_from: "2025-06-01")

    assert_equal 1, Demo::IntegrityCheck.new.violations[:overlapping_periods]
  end

  test "detects too many decimal places and a start before hire" do
    insert_salary(currency_code: "JPY", amount: "1000.5", effective_from: "2020-01-01")

    violations = Demo::IntegrityCheck.new.violations
    assert_equal 1, violations[:amount_scale_violations]
    assert_equal 1, violations[:starts_before_hire_date]
  end

  test "detects a history whose latest period is closed" do
    insert_salary(effective_from: "2025-01-01", effective_to: "2025-12-31")

    assert_equal 1, Demo::IntegrityCheck.new.violations[:latest_period_closed]
  end

  private

  def insert_salary(effective_from:, effective_to: nil, amount: "1000", currency_code: "INR")
    SalaryRecord.insert_all!([ { employee_id: @employee.id, amount: amount, currency_code: currency_code,
                                 effective_from: effective_from, effective_to: effective_to } ])
  end
end
