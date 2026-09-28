# Reference data the application needs in every environment (docs/database-design.md §8, J6).
# Loaded by db/seeds.rb; also used by the development demo seeder for each country's home currency.
module ReferenceData
  CURRENCIES = [
    { code: "USD", name: "US Dollar", minor_units: 2 },
    { code: "GBP", name: "Pound Sterling", minor_units: 2 },
    { code: "EUR", name: "Euro", minor_units: 2 },
    { code: "INR", name: "Indian Rupee", minor_units: 2 },
    { code: "JPY", name: "Japanese Yen", minor_units: 0 },
    { code: "SGD", name: "Singapore Dollar", minor_units: 2 },
    { code: "KWD", name: "Kuwaiti Dinar", minor_units: 3 }
  ].freeze

  COUNTRIES = [
    { code: "US", name: "United States", currency_code: "USD" },
    { code: "GB", name: "United Kingdom", currency_code: "GBP" },
    { code: "DE", name: "Germany", currency_code: "EUR" },
    { code: "FR", name: "France", currency_code: "EUR" },
    { code: "IN", name: "India", currency_code: "INR" },
    { code: "JP", name: "Japan", currency_code: "JPY" },
    { code: "SG", name: "Singapore", currency_code: "SGD" },
    { code: "KW", name: "Kuwait", currency_code: "KWD" }
  ].freeze

  DEPARTMENTS = [
    "Engineering", "Finance", "Human Resources", "Marketing",
    "Operations", "Sales", "Legal", "Customer Support"
  ].freeze

  # Idempotent: inserts missing rows and updates names in place (MySQL ON DUPLICATE KEY UPDATE).
  # Re-running with unchanged data changes no rows.
  def self.seed!
    ActiveRecord::Base.transaction do
      Currency.upsert_all(CURRENCIES)
      Country.upsert_all(COUNTRIES.map { |country| country.slice(:code, :name) })
      Department.upsert_all(DEPARTMENTS.map { |name| { name: name } })
    end
  end

  def self.home_currency_by_country_code
    COUNTRIES.to_h { |country| [ country[:code], country[:currency_code] ] }
  end
end
