require "test_helper"

class Demo::SeederTest < ActiveSupport::TestCase
  COUNT = 300

  test "creates the requested employees with clean salary histories" do
    Demo::Seeder.new(count: COUNT).call
    check = Demo::IntegrityCheck.new

    assert_equal COUNT, Employee.count
    assert check.clean?, check.violations.inspect
    assert_operator SalaryRecord.count, :>, COUNT
    assert Employee.all.all?(&:valid?), "seeded employees must pass model validations"
  end

  test "is deterministic: the same count produces identical data" do
    first = signature_after_seed
    SalaryRecord.delete_all
    Employee.delete_all

    assert_equal first, signature_after_seed
  end

  test "covers the scenarios the design asks for" do
    Demo::Seeder.new(count: COUNT).call
    summary = Demo::IntegrityCheck.new.summary(as_of: Demo::Seeder::AS_OF)

    assert_operator summary[:employees_by_country].size, :>=, 6, "multi-country"
    assert_operator summary[:current_salaries_by_currency].size, :>=, 5, "multi-currency"
    assert_equal %w[active on_leave terminated], summary[:employees_by_status].keys.sort
    assert_operator summary[:records_per_employee].keys.max, :>=, 2, "some employees have history"
    assert SalaryRecord.where(currency_code: %w[JPY KWD]).exists?, "0- and 3-decimal currencies"
  end

  test "refuses to run when employees already exist" do
    create(:employee)

    assert_raises(Demo::Seeder::EmployeesExistError) { Demo::Seeder.new(count: 5).call }
  end

  private

  def signature_after_seed
    Demo::Seeder.new(count: COUNT).call
    [
      Employee.order(:employee_number).pluck(:employee_number, :first_name, :last_name, :email, :employment_status, :hired_on),
      SalaryRecord.joins(:employee).order("employees.employee_number", :effective_from)
        .pluck("employees.employee_number", :amount, :currency_code, :effective_from, :effective_to)
    ]
  end
end
