require "test_helper"

class Salaries::ChangeServiceTest < ActiveSupport::TestCase
  setup do
    travel_to Date.new(2026, 9, 28)
    @employee = create(:employee, hired_on: Date.new(2021, 4, 12))
  end

  def change(attributes)
    Salaries::ChangeService.call(employee: @employee, attributes: attributes)
  end

  test "records a first salary as the open-ended current record" do
    record = change(amount: "85000.00", currency_code: "INR", effective_from: "2026-04-01")

    assert record.persisted?, record.errors.full_messages.to_sentence
    assert_nil record.effective_to
    assert_equal record, @employee.current_salary
  end

  test "closes the previous period on the day before the new start date and keeps it" do
    first = change(amount: "85000.00", currency_code: "INR", effective_from: "2026-04-01")
    second = change(amount: "92000.00", currency_code: "INR", effective_from: "2026-09-01")

    assert second.persisted?
    assert_equal Date.new(2026, 8, 31), first.reload.effective_to
    assert_equal BigDecimal("85000"), first.amount
    assert_equal 2, @employee.salary_records.count
    assert_equal second, @employee.current_salary
  end

  test "a future-dated change is scheduled and does not replace today's salary" do
    current = change(amount: "85000.00", currency_code: "INR", effective_from: "2026-04-01")
    scheduled = change(amount: "92000.00", currency_code: "INR", effective_from: "2027-04-01")

    assert_equal "scheduled", scheduled.status_on
    assert_equal current, @employee.current_salary
    assert_equal Date.new(2027, 3, 31), current.reload.effective_to
  end

  test "rejects a start date that is not after the latest record, leaving history untouched" do
    latest = change(amount: "85000.00", currency_code: "INR", effective_from: "2026-04-01")

    [ "2026-04-01", "2026-03-01" ].each do |date|
      rejected = change(amount: "90000.00", currency_code: "INR", effective_from: date)

      assert_not rejected.persisted?, "#{date} should be rejected"
      assert rejected.errors.of_kind?(:effective_from, :not_after_latest)
    end
    assert_nil latest.reload.effective_to
    assert_equal 1, @employee.salary_records.count
  end

  test "rolls back the period closing when the new record is invalid" do
    latest = change(amount: "85000.00", currency_code: "INR", effective_from: "2026-04-01")

    rejected = change(amount: "0", currency_code: "INR", effective_from: "2026-09-01")

    assert_not rejected.persisted?
    assert rejected.errors.of_kind?(:amount, :greater_than)
    assert_nil latest.reload.effective_to, "previous period must stay open after a failed change"
  end

  test "rejects a start date before the hire date" do
    record = change(amount: "85000.00", currency_code: "INR", effective_from: "2021-01-01")

    assert_not record.persisted?
    assert record.errors.of_kind?(:effective_from, :before_hire_date)
  end

  test "reports missing attributes without touching the database" do
    record = change({})

    assert_not record.persisted?
    %i[amount effective_from].each { |attribute| assert record.errors.of_kind?(attribute, :blank) }
  end

  test "ignores attributes outside amount, currency and start date" do
    record = change(amount: "85000.00", currency_code: "INR", effective_from: "2026-04-01", effective_to: "2026-04-30")

    assert record.persisted?
    assert_nil record.effective_to
  end

  test "locks the employee row while changing salary" do
    locked = false
    @employee.define_singleton_method(:lock!) { |*args| locked = true; super(*args) }

    change(amount: "85000.00", currency_code: "INR", effective_from: "2026-04-01")

    assert locked
  end
end
