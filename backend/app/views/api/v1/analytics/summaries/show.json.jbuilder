# Per-currency monthly summary (docs/api-specification.md §8.2). Aggregates only: no individual salaries.
# Every amount is rounded to its currency's minor units and paired with currency_code (ADR 002).
json.data do
  json.as_of @population.as_of
  json.period "monthly"
  json.filters @population.filters
  json.employees_in_scope @summary.employees_in_scope
  json.employees_without_salary @summary.employees_without_salary
  json.by_currency @summary.by_currency do |row|
    json.currency_code row.currency_code
    json.employee_count row.employee_count
    %i[total average median min max].each { |metric| json.set! metric, money(row.public_send(metric), row.minor_units) }
  end
end
