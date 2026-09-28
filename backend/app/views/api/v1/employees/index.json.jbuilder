json.data @employees, partial: "api/v1/employees/employee_summary", as: :employee
json.meta { json.partial! "api/v1/shared/pagination_meta", meta: @pagination_meta }
