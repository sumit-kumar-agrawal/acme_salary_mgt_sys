# Salary record (docs/api-specification.md §7.1). Amount is monthly gross base pay (D3), formatted to the
# currency's minor units; status and editable are relative to today (UTC).
json.id salary_record.id
json.employee_id salary_record.employee_id
json.amount money(salary_record.amount, salary_record.currency.minor_units)
json.currency_code salary_record.currency_code
json.period "monthly"
json.effective_from salary_record.effective_from
json.effective_to salary_record.effective_to
json.status salary_record.status_on
json.editable salary_record.editable?
json.created_at salary_record.created_at
json.updated_at salary_record.updated_at
