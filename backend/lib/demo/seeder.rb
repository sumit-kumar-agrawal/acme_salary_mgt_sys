module Demo
  # Deterministic synthetic employees and salary histories for development (docs/database-design.md §9, J6).
  # Every run with the same count produces identical data: fixed random seed and a fixed as-of date.
  # History rows are generated already closed so they satisfy the period rules without the services,
  # and are inserted with insert_all! (plain insert_all silently skips unique-key conflicts on MySQL).
  class Seeder
    SEED = 42
    AS_OF = Date.new(2026, 9, 28)
    BATCH_SIZE = 1_000
    HIRE_DATES = Date.new(2010, 1, 1)..Date.new(2026, 6, 30)
    # Plausible monthly gross base pay per currency (synthetic).
    MONTHLY_RANGES = {
      "USD" => 3_000..20_000, "GBP" => 2_500..15_000, "EUR" => 2_800..16_000, "INR" => 30_000..450_000,
      "JPY" => 250_000..1_500_000, "SGD" => 4_000..20_000, "KWD" => 800..5_000
    }.freeze

    class EmployeesExistError < StandardError; end

    def initialize(count: 10_000)
      @count = count
    end

    def call
      raise EmployeesExistError, "Employees already exist; use demo:reset to regenerate" if Employee.exists?

      with_seeded_faker do
        @rng = Random.new(SEED)
        employees, histories = build
        insert(employees, histories)
      end
    end

    private

    def build
      countries = Country.order(:code).pluck(:code, :id)
      department_ids = Department.order(:name).pluck(:id)
      minor_units = Currency.pluck(:code, :minor_units).to_h
      home_currency = ReferenceData.home_currency_by_country_code

      employees = []
      histories = {}
      (1..@count).each do |n|
        number = format("EMP-%05d", n)
        country_code, country_id = countries[@rng.rand(countries.size)]
        first_name = Faker::Name.first_name
        last_name = Faker::Name.last_name
        hired_on = random_date(HIRE_DATES)

        employees << {
          employee_number: number, first_name: first_name, last_name: last_name,
          email: "#{slug(first_name)}.#{slug(last_name)}.#{n}@example.test",
          country_id: country_id, department_id: department_ids[@rng.rand(department_ids.size)],
          employment_status: random_status, hired_on: hired_on
        }

        currency = @rng.rand < 0.05 ? "USD" : home_currency.fetch(country_code)
        histories[number] = salary_history(hired_on, currency, minor_units.fetch(currency))
      end
      [ employees, histories ]
    end

    def insert(employees, histories)
      ActiveRecord::Base.transaction do
        employees.each_slice(BATCH_SIZE) { |batch| Employee.insert_all!(batch) }
        ids = Employee.pluck(:employee_number, :id).to_h

        rows = histories.flat_map { |number, records| records.map { |record| record.merge(employee_id: ids.fetch(number)) } }
        rows.each_slice(BATCH_SIZE) { |batch| SalaryRecord.insert_all!(batch) }
      end
    end

    # About 1% no salary, 61% one record, 38% two to four records; about 2% also get a scheduled raise.
    def salary_history(hired_on, currency, minor_units)
      roll = @rng.rand
      return [] if roll < 0.01

      periods = []
      start = hired_on
      amount = random_amount(currency, minor_units)
      (roll < 0.62 ? 1 : 2 + @rng.rand(3)).times do
        break if start > AS_OF

        periods << [ start, amount ]
        start = start.next_month(6 + @rng.rand(19))
        amount = raise_amount(amount, minor_units)
      end

      if @rng.rand < 0.02
        periods << [ [ AS_OF.next_month(1 + @rng.rand(6)), periods.last[0] + 1 ].max, raise_amount(periods.last[1], minor_units) ]
      end

      periods.each_with_index.map do |(from, value), index|
        following = periods[index + 1]
        { amount: value, currency_code: currency, effective_from: from, effective_to: following && following[0] - 1 }
      end
    end

    def random_status
      roll = @rng.rand
      if roll < 0.90 then "active"
      elsif roll < 0.94 then "on_leave"
      else "terminated"
      end
    end

    def random_date(range)
      range.begin + @rng.rand((range.end - range.begin).to_i + 1)
    end

    def random_amount(currency, minor_units)
      range = MONTHLY_RANGES.fetch(currency)
      BigDecimal((range.begin + @rng.rand * (range.end - range.begin)).to_s).round(minor_units)
    end

    def raise_amount(amount, minor_units)
      (amount * BigDecimal((1.02 + @rng.rand * 0.10).to_s)).round(minor_units)
    end

    def slug(name)
      name.downcase.gsub(/[^a-z]/, "").presence || "x"
    end

    def with_seeded_faker
      previous = Faker::Config.random
      Faker::Config.random = Random.new(SEED)
      yield
    ensure
      Faker::Config.random = previous
    end
  end
end
