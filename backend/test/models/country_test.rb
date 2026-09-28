require "test_helper"

class CountryTest < ActiveSupport::TestCase
  test "reference fixtures are valid" do
    assert Country.all.all?(&:valid?)
    assert_equal 8, Country.count
  end

  test "normalizes the code to upper case" do
    assert_equal "BR", Country.new(code: " br ", name: "Brazil").code
  end

  test "requires a two-letter alphabetic code" do
    %w[IND I1 1N].each do |code|
      country = Country.new(code: code, name: "Somewhere")
      assert_not country.valid?, "#{code} should be invalid"
      assert country.errors.of_kind?(:code, :invalid)
    end
  end

  test "requires a unique code and name, ignoring case" do
    duplicate = Country.new(code: "in", name: "india")

    assert_not duplicate.valid?
    assert duplicate.errors.of_kind?(:code, :taken)
    assert duplicate.errors.of_kind?(:name, :taken)
  end

  test "cannot be destroyed while employees reference it" do
    employee = create(:employee, country: countries(:india))

    assert_raises(ActiveRecord::DeleteRestrictionError) { employee.country.destroy }
  end

  test "database rejects a duplicate code when validations are bypassed" do
    assert_raises(ActiveRecord::RecordNotUnique) do
      Country.insert_all!([ { code: "IN", name: "Another India" } ])
    end
  end

  test "database foreign key blocks deleting a referenced country" do
    employee = create(:employee, country: countries(:india))

    assert_raises(ActiveRecord::InvalidForeignKey) do
      Country.where(id: employee.country_id).delete_all
    end
  end
end
