require "test_helper"

class SalaryRecordTest < ActiveSupport::TestCase
  setup { @employee = create(:employee, hired_on: Date.new(2021, 4, 12)) }

  test "factory builds a valid open-ended record" do
    record = build(:salary_record, employee: @employee)

    assert record.valid?, record.errors.full_messages.to_sentence
  end

  # I4: amount
  test "requires a positive amount" do
    [ nil, 0, -1 ].each do |amount|
      assert_not build(:salary_record, employee: @employee, amount: amount).valid?, "#{amount.inspect} should be invalid"
    end
  end

  # I5 / J9: decimal places per currency
  test "limits decimal places to the currency's minor units" do
    {
      [ "JPY", "250000" ] => true, [ "JPY", "250000.5" ] => false,
      [ "USD", "7000.25" ] => true, [ "USD", "7000.255" ] => false,
      [ "KWD", "1500.125" ] => true, [ "KWD", "1500.1255" ] => false
    }.each do |(currency, amount), valid|
      record = build(:salary_record, employee: @employee, currency_code: currency, amount: amount)
      assert_equal valid, record.valid?, "#{currency} #{amount} should be #{valid ? 'valid' : 'invalid'}"
      assert record.errors.of_kind?(:amount, :too_many_decimal_places) unless valid
    end
  end

  test "rejects extra decimal places even beyond the column scale" do
    record = build(:salary_record, employee: @employee, currency_code: "USD", amount: "7000.12345")

    assert_not record.valid?
    assert record.errors.of_kind?(:amount, :too_many_decimal_places)
  end

  # I6: currency
  test "requires an existing currency and upper-cases the code" do
    assert_equal "USD", build(:salary_record, currency_code: " usd ").currency_code

    record = build(:salary_record, employee: @employee, currency_code: "XXX")
    assert_not record.valid?
    assert record.errors.of_kind?(:currency, :blank)
  end

  # I7: period order
  test "requires effective_to on or after effective_from" do
    assert_not build(:salary_record, employee: @employee, effective_from: Date.new(2026, 4, 1), effective_to: Date.new(2026, 3, 31)).valid?
    assert build(:salary_record, employee: @employee, effective_from: Date.new(2026, 4, 1), effective_to: Date.new(2026, 4, 1)).valid?
  end

  # I10: overlap
  test "rejects a period that overlaps another record of the same employee" do
    create(:salary_record, employee: @employee, effective_from: Date.new(2025, 1, 1), effective_to: Date.new(2025, 12, 31))

    overlapping = build(:salary_record, employee: @employee, effective_from: Date.new(2025, 6, 1), effective_to: Date.new(2026, 1, 31))
    assert_not overlapping.valid?
    assert overlapping.errors.of_kind?(:effective_from, :overlaps_existing_period)

    assert build(:salary_record, employee: @employee, effective_from: Date.new(2026, 1, 1)).valid?
  end

  # I13: hire date
  test "rejects a start date before the employee's hire date" do
    record = build(:salary_record, employee: @employee, effective_from: Date.new(2021, 4, 11))

    assert_not record.valid?
    assert record.errors.of_kind?(:effective_from, :before_hire_date)
    assert build(:salary_record, employee: @employee, effective_from: Date.new(2021, 4, 12)).valid?
  end

  # J8: read-only columns
  test "employee and start date cannot be changed once saved" do
    record = create(:salary_record, employee: @employee)

    assert_raises(ActiveRecord::ReadonlyAttributeError) { record.effective_from = Date.new(2026, 5, 1) }
    assert_raises(ActiveRecord::ReadonlyAttributeError) { record.employee_id = create(:employee).id }
  end

  # D7: in effect on a date, at boundaries (J12)
  test "in_effect_on selects the record covering the date, including boundary days" do
    old = create(:salary_record, employee: @employee, effective_from: Date.new(2025, 1, 1), effective_to: Date.new(2025, 12, 31))
    new = create(:salary_record, employee: @employee, effective_from: Date.new(2026, 1, 1))

    assert_equal [ old ], SalaryRecord.in_effect_on(Date.new(2025, 12, 31)).to_a
    assert_equal [ new ], SalaryRecord.in_effect_on(Date.new(2026, 1, 1)).to_a
    assert_empty SalaryRecord.in_effect_on(Date.new(2024, 12, 31))
  end

  test "status is scheduled, current, or historical relative to today" do
    record = create(:salary_record, employee: @employee, effective_from: Date.new(2026, 4, 1), effective_to: Date.new(2026, 6, 30))

    travel_to(Date.new(2026, 3, 31)) { assert_equal "scheduled", record.status_on; assert record.editable? }
    travel_to(Date.new(2026, 4, 1))  { assert_equal "current", record.status_on; assert record.editable? }
    travel_to(Date.new(2026, 6, 30)) { assert_equal "current", record.status_on }
    travel_to(Date.new(2026, 7, 1))  { assert_equal "historical", record.status_on; assert_not record.editable? }
  end

  # Database guards (J11) — also prove schema.rb kept them after db:test:prepare (J13)
  test "generated open_flag marks only the open-ended record" do
    closed = create(:salary_record, employee: @employee, effective_from: Date.new(2025, 1, 1), effective_to: Date.new(2025, 12, 31))
    open = create(:salary_record, employee: @employee, effective_from: Date.new(2026, 1, 1))

    assert_nil closed.reload.open_flag
    assert_equal 1, open.reload.open_flag
  end

  test "database allows only one open-ended record per employee" do
    create(:salary_record, employee: @employee, effective_from: Date.new(2026, 1, 1))

    assert_raises(ActiveRecord::RecordNotUnique) do
      SalaryRecord.insert_all!([ { employee_id: @employee.id, amount: 1, currency_code: "INR", effective_from: Date.new(2026, 2, 1) } ])
    end
  end

  test "database rejects two records with the same start date" do
    create(:salary_record, employee: @employee, effective_from: Date.new(2026, 1, 1), effective_to: Date.new(2026, 1, 31))

    assert_raises(ActiveRecord::RecordNotUnique) do
      SalaryRecord.insert_all!([ { employee_id: @employee.id, amount: 1, currency_code: "INR",
                                   effective_from: Date.new(2026, 1, 1), effective_to: Date.new(2026, 1, 31) } ])
    end
  end

  test "database check constraints reject a non-positive amount and a reversed period" do
    record = create(:salary_record, employee: @employee)

    assert_raises(ActiveRecord::StatementInvalid) { record.update_column(:amount, 0) }
    assert_raises(ActiveRecord::StatementInvalid) { record.update_column(:effective_to, record.effective_from - 1.day) }
  end

  test "database foreign keys reject an unknown currency" do
    record = create(:salary_record, employee: @employee)

    assert_raises(ActiveRecord::InvalidForeignKey) { record.update_column(:currency_code, "XXX") }
  end

  test "employees and currencies with salary records cannot be deleted" do
    record = create(:salary_record, employee: @employee)

    assert_raises(ActiveRecord::DeleteRestrictionError) { @employee.destroy }
    assert_raises(ActiveRecord::DeleteRestrictionError) { record.currency.destroy }
    assert_raises(ActiveRecord::InvalidForeignKey) { Employee.where(id: @employee.id).delete_all }
  end
end
