require "test_helper"
require_relative "analytics_test_helper"

class Analytics::BreakdownQueryTest < ActiveSupport::TestCase
  include AnalyticsTestHelper

  def breakdown(by, **filters)
    Analytics::BreakdownQuery.new(population(**filters), by: by).call
  end

  test "groups by country and currency, ordered by country name then currency" do
    germany = countries(:germany)
    india = countries(:india)
    paid("5000.00", "EUR", country: germany)
    paid("6000.00", "EUR", country: germany)
    paid("7000.00", "EUR", country: germany)
    paid("6500.00", "USD", country: germany)
    paid("85000.00", "INR", country: india)

    rows = breakdown("country")
    assert_equal [ %w[Germany EUR], %w[Germany USD], %w[India INR] ], rows.map { |row| [ row.dimension.name, row.currency_code ] }

    eur = rows.first
    assert_equal [ germany.id, "DE" ], [ eur.dimension.id, eur.dimension.code ]
    assert_equal [ 3, BigDecimal("18000"), BigDecimal("6000"), BigDecimal("6000"), 2 ],
      [ eur.employee_count, eur.total, eur.average, eur.median, eur.minor_units ]
    assert_equal [ 1, BigDecimal("6500"), BigDecimal("6500") ], [ rows.second.employee_count, rows.second.total, rows.second.median ]
  end

  test "groups by department, which has no code" do
    paid("5000.00", "EUR", department: departments(:finance))
    paid("5200.00", "EUR", department: departments(:finance))
    paid("9000.00", "EUR", department: departments(:engineering))

    rows = breakdown("department")
    assert_equal %w[Engineering Finance], rows.map { |row| row.dimension.name }
    assert_nil rows.first.dimension.code
    assert_equal BigDecimal("5100"), rows.second.median
  end

  test "other filters still apply alongside the dimension" do
    germany = countries(:germany)
    paid("5000.00", "EUR", country: germany, department: departments(:finance))
    paid("9000.00", "INR", department: departments(:finance))
    paid("7000.00", "EUR", country: germany, employment_status: "terminated")

    rows = breakdown("department", country_id: germany.id)
    assert_equal [ [ "Finance", "EUR", 1 ] ], rows.map { |row| [ row.dimension.name, row.currency_code, row.employee_count ] }
  end

  test "rejects an unknown dimension" do
    assert_raises(ArgumentError) { Analytics::BreakdownQuery.new(population, by: "employees.id") }
  end

  test "an empty population has no rows" do
    assert_empty breakdown("country")
  end
end
