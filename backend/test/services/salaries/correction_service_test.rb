require "test_helper"

class Salaries::CorrectionServiceTest < ActiveSupport::TestCase
  setup do
    travel_to Date.new(2026, 9, 28)
    @employee = create(:employee, hired_on: Date.new(2021, 4, 12))
    @historical = create(:salary_record, employee: @employee, amount: "80000.00",
      effective_from: Date.new(2025, 4, 1), effective_to: Date.new(2026, 3, 31))
    @current = create(:salary_record, employee: @employee, amount: "85000.00",
      effective_from: Date.new(2026, 4, 1), effective_to: Date.new(2027, 3, 31))
    @scheduled = create(:salary_record, employee: @employee, amount: "92000.00",
      effective_from: Date.new(2027, 4, 1))
  end

  def correct(record, attributes)
    Salaries::CorrectionService.call(record: record, attributes: attributes)
  end

  test "corrects the amount of the current record" do
    result = correct(@current, amount: "86000.00")

    assert result.errors.empty?, result.errors.full_messages.to_sentence
    assert_equal BigDecimal("86000"), @current.reload.amount
  end

  test "corrects a scheduled record (O1)" do
    result = correct(@scheduled, amount: "93000.00", currency_code: "USD")

    assert result.errors.empty?, result.errors.full_messages.to_sentence
    assert_equal [ BigDecimal("93000"), "USD" ], @scheduled.reload.values_at(:amount, :currency_code)
  end

  test "rejects a correction to a historical record and leaves it unchanged" do
    result = correct(@historical, amount: "1.00")

    assert result.errors.of_kind?(:base, :not_editable)
    assert_equal BigDecimal("80000"), @historical.reload.amount
  end

  test "rejects date changes as immutable" do
    result = correct(@current, amount: "86000.00", effective_from: "2026-05-01", effective_to: "2026-12-31")

    assert result.errors.of_kind?(:effective_from, :immutable)
    assert result.errors.of_kind?(:effective_to, :immutable)
    assert_equal [ BigDecimal("85000"), Date.new(2026, 4, 1) ], @current.reload.values_at(:amount, :effective_from)
  end

  test "validates the corrected values against the new currency" do
    result = correct(@current, currency_code: "JPY", amount: "85000.50")

    assert result.errors.of_kind?(:amount, :too_many_decimal_places)
    assert_equal "INR", @current.reload.currency_code
  end

  test "the record becomes uncorrectable once its period has ended" do
    travel_to Date.new(2027, 4, 1)

    assert correct(@current, amount: "86000.00").errors.of_kind?(:base, :not_editable)
  end
end
