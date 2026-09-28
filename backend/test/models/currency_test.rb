require "test_helper"

class CurrencyTest < ActiveSupport::TestCase
  test "reference fixtures are valid and keyed by code" do
    assert Currency.all.all?(&:valid?)
    assert_equal 7, Currency.count
    assert_equal "Japanese Yen", Currency.find("JPY").name
  end

  test "reference data covers 0, 2 and 3 minor units" do
    assert_equal({ "JPY" => 0, "USD" => 2, "KWD" => 3 },
      Currency.where(code: %w[JPY USD KWD]).pluck(:code, :minor_units).to_h)
  end

  test "normalizes the code to upper case" do
    assert_equal "CHF", Currency.new(code: " chf ", name: "Swiss Franc", minor_units: 2).code
  end

  test "requires a three-letter alphabetic code" do
    %w[US USDX U5D].each do |code|
      currency = Currency.new(code: code, name: "Test", minor_units: 2)
      assert_not currency.valid?, "#{code} should be invalid"
    end
  end

  test "requires a unique code" do
    duplicate = Currency.new(code: "usd", name: "Duplicate", minor_units: 2)

    assert_not duplicate.valid?
    assert duplicate.errors.of_kind?(:code, :taken)
  end

  test "minor units must be an integer between 0 and 4" do
    [ -1, 5, 1.5, nil ].each do |units|
      currency = Currency.new(code: "CHF", name: "Swiss Franc", minor_units: units)
      assert_not currency.valid?, "#{units.inspect} should be invalid"
    end
    assert Currency.new(code: "CHF", name: "Swiss Franc", minor_units: 4).valid?
  end

  test "database check constraint rejects minor units above 4" do
    assert_raises(ActiveRecord::StatementInvalid) do
      currencies(:usd).update_column(:minor_units, 5)
    end
  end
end
