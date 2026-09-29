# Known-data helpers for the analytics query tests (BACKEND_PLAN.md M18). Amounts are explicit and
# "today" is fixed with travel_to, so every expected figure can be checked by hand.
module AnalyticsTestHelper
  TODAY = Date.new(2026, 9, 28)

  def self.included(base)
    base.setup { travel_to TODAY }
  end

  # An employee with one open-ended salary starting on effective_from.
  def paid(amount, currency_code, effective_from: Date.new(2026, 4, 1), **employee_attributes)
    employee = create(:employee, **employee_attributes)
    create(:salary_record, employee: employee, amount: amount, currency_code: currency_code,
      effective_from: effective_from)
    employee
  end

  def population(**filters)
    Analytics::Population.new(as_of: TODAY, **filters)
  end
end
