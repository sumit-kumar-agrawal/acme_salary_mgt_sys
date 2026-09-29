# Salary report rows (docs/api-specification.md §9.1): no email (D18). meta adds the applied as_of and
# filters to the standard pagination meta.
json.data @salary_records do |salary_record|
  employee = salary_record.employee
  json.employee_id employee.id
  json.employee_number employee.employee_number
  json.first_name employee.first_name
  json.last_name employee.last_name
  json.country { json.extract! employee.country, :code, :name }
  json.department { json.extract! employee.department, :name }
  json.employment_status employee.employment_status
  json.amount money(salary_record.amount, salary_record.currency.minor_units)
  json.currency_code salary_record.currency_code
  json.period "monthly"
  json.effective_from salary_record.effective_from
end
json.meta do
  json.partial! "api/v1/shared/pagination_meta", meta: @pagination_meta
  json.as_of @population.as_of
  json.filters @population.filters.merge(q: @q)
end
