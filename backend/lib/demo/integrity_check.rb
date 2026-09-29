module Demo
  # Read-only SQL checks of the salary history rules against whatever data is in the database
  # (docs/database-design.md §5, §12). Every check counts violating rows; all must be zero.
  class IntegrityCheck
    CHECKS = {
      # I10: two periods of one employee overlap
      overlapping_periods: <<~SQL,
        SELECT COUNT(*) FROM salary_records a
        JOIN salary_records b ON a.employee_id = b.employee_id AND a.id < b.id
         AND a.effective_from <= COALESCE(b.effective_to, '9999-12-31')
         AND b.effective_from <= COALESCE(a.effective_to, '9999-12-31')
      SQL
      # I9: more than one open-ended record per employee
      multiple_open_records: <<~SQL,
        SELECT COUNT(*) FROM (
          SELECT employee_id FROM salary_records WHERE effective_to IS NULL
          GROUP BY employee_id HAVING COUNT(*) > 1
        ) t
      SQL
      # I5: more decimal places than the currency allows
      amount_scale_violations: <<~SQL,
        SELECT COUNT(*) FROM salary_records sr JOIN currencies c ON c.code = sr.currency_code
        WHERE ROUND(sr.amount, c.minor_units) <> sr.amount
      SQL
      # I13: salary starts before the hire date
      starts_before_hire_date: <<~SQL,
        SELECT COUNT(*) FROM salary_records sr JOIN employees e ON e.id = sr.employee_id
        WHERE e.hired_on IS NOT NULL AND sr.effective_from < e.hired_on
      SQL
      # I4 / I7: non-positive amount or reversed period (also CHECK constraints)
      invalid_amount_or_period: <<~SQL,
        SELECT COUNT(*) FROM salary_records
        WHERE amount <= 0 OR (effective_to IS NOT NULL AND effective_to < effective_from)
      SQL
      # Histories must end with an open record (the latest period is never closed)
      latest_period_closed: <<~SQL
        SELECT COUNT(*) FROM salary_records sr
        WHERE sr.effective_to IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM salary_records n
                          WHERE n.employee_id = sr.employee_id AND n.effective_from > sr.effective_from)
      SQL
    }.freeze

    def violations
      connection = ActiveRecord::Base.connection
      CHECKS.transform_values { |sql| connection.select_value(sql).to_i }
    end

    def clean?
      violations.values.all?(&:zero?)
    end

    def summary(as_of: Date.current)
      in_effect = SalaryRecord.in_effect_on(as_of)
      {
        employees: Employee.count,
        salary_records: SalaryRecord.count,
        employees_by_status: Employee.group(:employment_status).count.sort.to_h,
        employees_by_country: Employee.joins(:country).group("countries.code").count.sort.to_h,
        current_salaries_by_currency: in_effect.group(:currency_code).count.sort.to_h,
        # No salary record at all; the analytics field employees_without_salary is "none in effect on as_of".
        employees_without_salary_records: Employee.where.missing(:salary_records).count,
        records_per_employee: SalaryRecord.group(:employee_id).count.values.tally.sort.to_h,
        scheduled_records: SalaryRecord.where("effective_from > ?", as_of).count
      }
    end
  end
end
