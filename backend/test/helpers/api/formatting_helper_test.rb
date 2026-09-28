require "test_helper"

class Api::FormattingHelperTest < ActionView::TestCase
  include Api::FormattingHelper

  test "formats money with exactly the currency's minor units" do
    assert_equal "85000.00", money(BigDecimal("85000.0000"), 2)
    assert_equal "250000", money(BigDecimal("250000"), 0)
    assert_equal "1500.125", money(BigDecimal("1500.1250"), 3)
    assert_equal "7000.25", money("7000.25", 2)
  end

  test "rounds half up without floating-point error" do
    assert_equal "0.13", money(BigDecimal("0.125"), 2)
    assert_equal "1234567890123.46", money(BigDecimal("1234567890123.455"), 2)
  end

  test "returns nil for a missing amount" do
    assert_nil money(nil, 2)
  end
end
