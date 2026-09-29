require "test_helper"
require_relative "analytics_test_helper"

class Analytics::PopulationTest < ActiveSupport::TestCase
  include AnalyticsTestHelper

  test "includes active and on-leave employees by default and excludes terminated ones" do
    active = paid("50000.00", "INR", employment_status: "active")
    on_leave = paid("60000.00", "INR", employment_status: "on_leave")
    paid("70000.00", "INR", employment_status: "terminated")

    assert_equal [ active, on_leave ].map(&:id).sort, population.employees.pluck(:id).sort
    assert_equal 2, population.salaries.count
  end

  test "a requested status includes only that status" do
    terminated = paid("70000.00", "INR", employment_status: "terminated")
    paid("50000.00", "INR")

    assert_equal [ terminated.id ], population(employment_status: "terminated").employees.pluck(:id)
  end

  test "filters by country and department" do
    germany = countries(:germany)
    finance = departments(:finance)
    match = paid("5000.00", "EUR", country: germany, department: finance)
    paid("5000.00", "EUR", country: germany)
    paid("5000.00", "EUR", department: finance)

    scope = population(country_id: germany.id, department_id: finance.id)
    assert_equal [ match.id ], scope.employees.pluck(:id)
    assert_equal [ match.id ], scope.salaries.pluck(:employee_id)
  end

  test "employees hired after as_of are out of scope; a missing hire date counts as hired" do
    paid("50000.00", "INR", hired_on: Date.new(2026, 10, 1), effective_from: Date.new(2026, 10, 1))
    no_hire_date = create(:employee, hired_on: nil)

    assert_equal [ no_hire_date.id ], population.employees.pluck(:id)
  end

  test "selects the record in effect on as_of: effective_to is inclusive and scheduled records are ignored" do
    employee = create(:employee)
    old = create(:salary_record, employee: employee, amount: "40000.00", effective_from: Date.new(2025, 1, 1),
      effective_to: Date.new(2026, 3, 31))
    current = create(:salary_record, employee: employee, amount: "50000.00", effective_from: Date.new(2026, 4, 1),
      effective_to: Date.new(2026, 12, 31))
    create(:salary_record, employee: employee, amount: "60000.00", effective_from: Date.new(2027, 1, 1))

    assert_equal [ current.id ], population.salaries.pluck(:id)
    assert_equal [ old.id ], Analytics::Population.new(as_of: Date.new(2026, 3, 31)).salaries.pluck(:id)
    assert_equal [ current.id ], Analytics::Population.new(as_of: Date.new(2026, 12, 31)).salaries.pluck(:id)
  end

  test "as_of defaults to today" do
    assert_equal AnalyticsTestHelper::TODAY, Analytics::Population.new.as_of
  end
end
