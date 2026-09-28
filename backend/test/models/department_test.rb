require "test_helper"

class DepartmentTest < ActiveSupport::TestCase
  test "reference fixtures are valid" do
    assert Department.all.all?(&:valid?)
    assert_equal 8, Department.count
  end

  test "requires a name" do
    department = Department.new(name: " ")

    assert_not department.valid?
    assert department.errors.of_kind?(:name, :blank)
  end

  test "requires a unique name, ignoring case" do
    duplicate = Department.new(name: "engineering")

    assert_not duplicate.valid?
    assert duplicate.errors.of_kind?(:name, :taken)
  end

  test "cannot be destroyed while employees reference it" do
    employee = create(:employee, department: departments(:finance))

    assert_raises(ActiveRecord::DeleteRestrictionError) { employee.department.destroy }
  end

  test "database rejects a duplicate name when validations are bypassed" do
    assert_raises(ActiveRecord::RecordNotUnique) do
      Department.insert_all!([ { name: "Engineering" } ])
    end
  end
end
