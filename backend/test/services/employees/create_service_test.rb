require "test_helper"

class Employees::CreateServiceTest < ActiveSupport::TestCase
  setup { travel_to Date.new(2026, 9, 28) }

  def employee_attributes(overrides = {})
    {
      employee_number: "EMP-10001", first_name: "Asha", last_name: "Rao", email: "asha.rao@example.test",
      country_id: countries(:india).id, department_id: departments(:engineering).id,
      employment_status: "active", hired_on: "2026-10-01"
    }.merge(overrides)
  end

  test "creates an employee without a salary" do
    employee = Employees::CreateService.call(attributes: employee_attributes)

    assert employee.persisted?, employee.errors.full_messages.to_sentence
    assert_empty employee.salary_records
  end

  test "creates an employee with an initial salary in one step" do
    employee = Employees::CreateService.call(attributes: employee_attributes(
      initial_salary: { amount: "85000.00", currency_code: "INR", effective_from: "2026-10-01" }
    ))

    assert employee.persisted?, employee.errors.full_messages.to_sentence
    salary = employee.salary_records.sole
    assert_equal [ BigDecimal("85000"), "INR", nil ], salary.values_at(:amount, :currency_code, :effective_to)
    assert_equal "scheduled", salary.status_on
  end

  test "creates nothing when the initial salary is invalid and reports prefixed errors" do
    assert_no_difference -> { Employee.count } do
      assert_no_difference -> { SalaryRecord.count } do
        employee = Employees::CreateService.call(attributes: employee_attributes(
          initial_salary: { amount: "0", currency_code: "INR", effective_from: "2026-09-01" }
        ))

        assert_not employee.persisted?
        assert employee.errors.of_kind?(:"initial_salary.amount", :greater_than)
        assert employee.errors.of_kind?(:"initial_salary.effective_from", :before_hire_date)
      end
    end
  end

  test "creates nothing when the employee is invalid" do
    assert_no_difference [ -> { Employee.count }, -> { SalaryRecord.count } ] do
      employee = Employees::CreateService.call(attributes: employee_attributes(
        first_name: "", initial_salary: { amount: "85000.00", currency_code: "INR", effective_from: "2026-10-01" }
      ))

      assert employee.errors.of_kind?(:first_name, :blank)
    end
  end
end
