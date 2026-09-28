# List item (docs/api-specification.md §6.1): no email and no salary (D18).
json.id employee.id
json.employee_number employee.employee_number
json.first_name employee.first_name
json.last_name employee.last_name
json.country { json.extract! employee.country, :id, :code, :name }
json.department { json.extract! employee.department, :id, :name }
json.employment_status employee.employment_status
json.hired_on employee.hired_on
