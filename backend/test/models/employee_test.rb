require "test_helper"

class EmployeeTest < ActiveSupport::TestCase
  test "factory builds a valid active employee" do
    employee = build(:employee)

    assert employee.valid?, employee.errors.full_messages.to_sentence
    assert employee.active?
  end

  test "requires number, names, country and department" do
    employee = Employee.new

    assert_not employee.valid?
    %i[employee_number first_name last_name country department].each do |attribute|
      assert employee.errors.of_kind?(attribute, :blank), "#{attribute} should be required"
    end
  end

  # I1: employee number
  test "normalizes the employee number to upper case without surrounding spaces" do
    assert_equal "EMP-00123", build(:employee, employee_number: "  emp-00123 ").employee_number
  end

  test "rejects employee numbers with invalid characters or over 20 characters" do
    [ "EMP 001", "EMP_001", "EMP-#{'1' * 17}" ].each do |number|
      employee = build(:employee, employee_number: number)
      assert_not employee.valid?, "#{number} should be invalid"
    end
  end

  test "requires a unique employee number, ignoring case" do
    create(:employee, employee_number: "EMP-00001")
    duplicate = build(:employee, employee_number: "emp-00001")

    assert_not duplicate.valid?
    assert duplicate.errors.of_kind?(:employee_number, :taken)
  end

  test "database rejects a duplicate employee number when validations are bypassed" do
    existing = create(:employee)
    row = existing.attributes.except("id", "created_at", "updated_at").merge("email" => nil)

    assert_raises(ActiveRecord::RecordNotUnique) { Employee.insert_all!([ row ]) }
  end

  # Email normalisation (J5)
  test "normalizes email to lower case and stores blank as nil" do
    assert_equal "asha.rao@example.test", build(:employee, email: " Asha.Rao@Example.TEST ").email
    assert_nil build(:employee, email: "   ").email
  end

  test "allows many employees without an email" do
    create(:employee, email: nil)

    assert create(:employee, email: "").persisted?
  end

  test "requires a unique, well-formed email when present" do
    create(:employee, email: "asha.rao@example.test")

    duplicate = build(:employee, email: "ASHA.RAO@example.test")
    assert_not duplicate.valid?
    assert duplicate.errors.of_kind?(:email, :taken)

    malformed = build(:employee, email: "not-an-email")
    assert_not malformed.valid?
    assert malformed.errors.of_kind?(:email, :invalid)
  end

  test "rejects names longer than 100 characters" do
    assert_not build(:employee, first_name: "a" * 101).valid?
    assert_not build(:employee, last_name: "b" * 101).valid?
  end

  # I3: employment status
  test "defaults employment status to active" do
    assert_equal "active", Employee.new.employment_status
  end

  test "accepts only the documented employment statuses" do
    %w[active on_leave terminated].each do |status|
      assert build(:employee, employment_status: status).valid?, "#{status} should be valid"
    end

    employee = build(:employee, employment_status: "retired")
    assert_not employee.valid?
    assert employee.errors.of_kind?(:employment_status, :inclusion)
  end

  test "database check constraint rejects an unknown employment status" do
    employee = create(:employee)

    assert_raises(ActiveRecord::StatementInvalid) do
      Employee.connection.execute(
        Employee.sanitize_sql([ "UPDATE employees SET employment_status = ? WHERE id = ?", "retired", employee.id ])
      )
    end
  end

  # I2: references
  test "database rejects a missing employee number" do
    employee = create(:employee)

    assert_raises(ActiveRecord::NotNullViolation) { employee.update_column(:employee_number, nil) }
  end

  # Salary relationship (3.2)
  test "current_salary is the record in effect today, never a scheduled one" do
    travel_to Date.new(2026, 9, 28)
    employee = create(:employee)
    assert_nil employee.current_salary

    current = create(:salary_record, employee: employee, effective_from: Date.new(2026, 4, 1), effective_to: Date.new(2026, 12, 31))
    create(:salary_record, employee: employee, effective_from: Date.new(2027, 1, 1))

    assert_equal current, employee.current_salary
  end

  # I13, employee side (J10)
  test "hired_on cannot move after the first salary start date" do
    employee = create(:employee, hired_on: Date.new(2021, 4, 12))
    create(:salary_record, employee: employee, effective_from: Date.new(2021, 5, 1))

    assert_not employee.update(hired_on: Date.new(2021, 5, 2))
    assert employee.errors.of_kind?(:hired_on, :after_first_salary)
    assert employee.update(hired_on: Date.new(2021, 5, 1))
  end

  test "database rejects an unknown country" do
    employee = create(:employee)

    assert_raises(ActiveRecord::InvalidForeignKey) { employee.update_column(:country_id, 0) }
  end
end
