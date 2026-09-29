require "test_helper"
require_relative "analytics_test_helper"

class Analytics::SummaryQueryTest < ActiveSupport::TestCase
  include AnalyticsTestHelper

  def summary(**filters)
    Analytics::SummaryQuery.new(population(**filters)).call
  end

  def by_code(result)
    result.by_currency.index_by(&:currency_code)
  end

  test "computes every metric within each currency and never across currencies" do
    %w[30000.00 50000.00 100000.00].each { |amount| paid(amount, "INR") }
    %w[300000 400000].each { |amount| paid(amount, "JPY") }
    paid("1000.125", "KWD")

    result = summary
    assert_equal %w[INR JPY KWD], result.by_currency.map(&:currency_code)

    inr, jpy, kwd = result.by_currency
    assert_equal [ 3, BigDecimal("180000"), BigDecimal("60000"), BigDecimal("50000"), BigDecimal("30000"), BigDecimal("100000") ],
      [ inr.employee_count, inr.total, inr.average, inr.median, inr.min, inr.max ]
    assert_equal [ 2, BigDecimal("700000"), BigDecimal("350000"), BigDecimal("350000") ],
      [ jpy.employee_count, jpy.total, jpy.average, jpy.median ]
    assert_equal [ 1, BigDecimal("1000.125"), BigDecimal("1000.125"), BigDecimal("1000.125") ],
      [ kwd.employee_count, kwd.total, kwd.average, kwd.median ]
    assert_equal [ 2, 0, 3 ], [ inr.minor_units, jpy.minor_units, kwd.minor_units ]
    refute_respond_to result, :total
  end

  test "median takes the middle value for odd counts and the mean of the two middle values for even counts" do
    %w[10.00 20.00 90.00].each { |amount| paid(amount, "USD") }
    %w[10.00 20.00 30.00 1000.00].each { |amount| paid(amount, "EUR") }
    %w[100001 100002].each { |amount| paid(amount, "JPY") }

    medians = by_code(summary).transform_values(&:median)
    assert_equal BigDecimal("20"), medians["USD"]
    assert_equal BigDecimal("25"), medians["EUR"]
    assert_equal BigDecimal("100001.5"), medians["JPY"], "exact here; views round to minor units"
  end

  test "counts employees in scope and those without a salary on as_of, excluding them from the money metrics" do
    paid("50000.00", "INR")
    create(:employee)
    paid("60000.00", "INR", effective_from: Date.new(2027, 1, 1))

    result = summary
    assert_equal 3, result.employees_in_scope
    assert_equal 2, result.employees_without_salary
    assert_equal 1, by_code(result)["INR"].employee_count
  end

  test "excludes terminated employees unless that status is requested" do
    paid("50000.00", "INR")
    paid("90000.00", "INR", employment_status: "terminated")

    assert_equal BigDecimal("50000"), by_code(summary)["INR"].total
    assert_equal BigDecimal("90000"), by_code(summary(employment_status: "terminated"))["INR"].total
  end

  test "uses the salary in effect on a past as_of" do
    employee = create(:employee)
    create(:salary_record, employee: employee, amount: "40000.00", effective_from: Date.new(2025, 1, 1),
      effective_to: Date.new(2026, 3, 31))
    create(:salary_record, employee: employee, amount: "50000.00", effective_from: Date.new(2026, 4, 1))

    past = Analytics::SummaryQuery.new(Analytics::Population.new(as_of: Date.new(2026, 3, 31))).call
    assert_equal BigDecimal("40000"), by_code(past)["INR"].total
    assert_equal BigDecimal("50000"), by_code(summary)["INR"].total
  end

  test "an empty population has no currency rows" do
    result = summary
    assert_equal [ 0, 0, [] ], [ result.employees_in_scope, result.employees_without_salary, result.by_currency ]
  end
end
