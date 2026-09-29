require "test_helper"
require_relative "analytics_test_helper"

class Analytics::DistributionQueryTest < ActiveSupport::TestCase
  include AnalyticsTestHelper

  def distribution(**filters)
    Analytics::DistributionQuery.new(population(**filters)).call.index_by(&:currency_code)
  end

  test "returns ten fixed-width bands with exact edges, including empty bands" do
    %w[1000.00 1099.99 1100.00 1500.00 1950.00 2000.00].each { |amount| paid(amount, "USD") }

    usd = distribution["USD"]
    assert_equal 6, usd.employee_count
    assert_equal 10, usd.bands.size
    assert_equal (0..9).map { |k| BigDecimal(1000 + 100 * k) }, usd.bands.map(&:lower)
    assert_equal (1..10).map { |k| BigDecimal(1000 + 100 * k) }, usd.bands.map(&:upper)
    # 1000 and 1099.99 in band 0; 1100 (a lower edge) in band 1; 1500 in band 5; 1950 and the max 2000 in band 9.
    assert_equal [ 2, 1, 0, 0, 0, 1, 0, 0, 0, 2 ], usd.bands.map(&:count)
  end

  test "values on an edge of a non-terminating width land in the upper band" do
    %w[100.00 100.89 100.90 103.00].each { |amount| paid(amount, "USD") }

    counts = distribution["USD"].bands.map(&:count)
    # Width 0.3: 100.89 is in band 2 ([100.60, 100.90)); 100.90 starts band 3.
    assert_equal [ 1, 0, 1, 1, 0, 0, 0, 0, 0, 1 ], counts
  end

  test "all amounts equal gives a single band" do
    2.times { paid("5000.00", "EUR") }

    eur = distribution["EUR"]
    assert_equal 1, eur.bands.size
    assert_equal [ BigDecimal("5000"), BigDecimal("5000"), 2 ], [ eur.bands[0].lower, eur.bands[0].upper, eur.bands[0].count ]
  end

  test "bands are computed per currency from that currency's own min and max" do
    %w[250000 1500000].each { |amount| paid(amount, "JPY") }
    %w[800.000 800.500 5000.000].each { |amount| paid(amount, "KWD") }

    result = distribution
    assert_equal %w[JPY KWD], result.keys
    assert_equal [ BigDecimal("250000"), BigDecimal("1500000") ], [ result["JPY"].bands.first.lower, result["JPY"].bands.last.upper ]
    assert_equal [ BigDecimal("800"), BigDecimal("5000") ], [ result["KWD"].bands.first.lower, result["KWD"].bands.last.upper ]
    assert_equal [ 1, 0, 0, 0, 0, 0, 0, 0, 0, 1 ], result["JPY"].bands.map(&:count)
    assert_equal [ 2, 0, 0, 0, 0, 0, 0, 0, 0, 1 ], result["KWD"].bands.map(&:count)
    assert_equal [ 0, 3 ], [ result["JPY"].minor_units, result["KWD"].minor_units ]
  end

  test "a currency with no one in scope is omitted" do
    paid("5000.00", "EUR", employment_status: "terminated")

    assert_empty distribution
  end
end
