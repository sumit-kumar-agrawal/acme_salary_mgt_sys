require "test_helper"

class ReferenceDataTest < ActiveSupport::TestCase
  test "seed data matches the test fixtures (one source of truth for design §8)" do
    assert_equal ReferenceData::CURRENCIES.map { |c| c.values_at(:code, :name, :minor_units) }.sort,
      Currency.pluck(:code, :name, :minor_units).sort
    assert_equal ReferenceData::COUNTRIES.map { |c| c.values_at(:code, :name) }.sort, Country.pluck(:code, :name).sort
    assert_equal ReferenceData::DEPARTMENTS.sort, Department.pluck(:name).sort
  end

  test "every country's home currency exists" do
    assert_empty ReferenceData.home_currency_by_country_code.values - Currency.pluck(:code)
  end

  test "seeding is idempotent: re-running changes no rows" do
    before = snapshot

    2.times { ReferenceData.seed! }

    assert_equal before, snapshot
  end

  test "seeding restores missing reference rows" do
    Department.where(name: "Legal").delete_all

    ReferenceData.seed!

    assert Department.exists?(name: "Legal")
    assert_equal 8, Department.count
  end

  private

  def snapshot
    [ Currency, Country, Department ].to_h do |model|
      [ model.name, model.order(model.primary_key).pluck(model.primary_key, :updated_at) ]
    end
  end
end
