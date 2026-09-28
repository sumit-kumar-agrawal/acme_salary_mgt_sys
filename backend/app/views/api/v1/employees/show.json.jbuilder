# Employee detail (docs/api-specification.md §6.2): adds email, the salary in effect today, and timestamps.
# @current_salary is loaded by the controller.
current_salary = @current_salary

json.data do
  json.id @employee.id
  json.employee_number @employee.employee_number
  json.first_name @employee.first_name
  json.last_name @employee.last_name
  json.email @employee.email
  json.country { json.extract! @employee.country, :id, :code, :name }
  json.department { json.extract! @employee.department, :id, :name }
  json.employment_status @employee.employment_status
  json.hired_on @employee.hired_on

  if current_salary
    json.current_salary do
      json.id current_salary.id
      json.amount money(current_salary.amount, current_salary.currency.minor_units)
      json.currency_code current_salary.currency_code
      json.period "monthly"
      json.effective_from current_salary.effective_from
      json.effective_to current_salary.effective_to
    end
  else
    json.current_salary nil
  end

  json.created_at @employee.created_at
  json.updated_at @employee.updated_at
end
