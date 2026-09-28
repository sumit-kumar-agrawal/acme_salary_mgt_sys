# Synthetic monthly salaries. Tests that need realistic history should build it through
# Salaries::ChangeService; this factory creates a single record directly.
FactoryBot.define do
  factory :salary_record do
    employee
    amount { "85000.00" }
    currency_code { "INR" }
    effective_from { Date.new(2026, 4, 1) }
    effective_to { nil }
  end
end
