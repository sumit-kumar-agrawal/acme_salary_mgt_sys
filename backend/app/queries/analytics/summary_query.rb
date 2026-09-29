module Analytics
  # Per-currency monthly total, average, median, min, and max (docs/api-specification.md §8.2, design §7.1).
  # Amounts are never combined across currencies (ADR 002). Values are exact BigDecimals; views round them.
  class SummaryQuery
    Result = Data.define(:employees_in_scope, :employees_without_salary, :by_currency)
    CurrencySummary = Data.define(:currency_code, :minor_units, :employee_count, :total, :average, :median, :min, :max)

    def initialize(population)
      @population = population
    end

    def call
      rows = @population.salaries.group(:currency_code).order(:currency_code).pluck(
        :currency_code, Arel.sql("COUNT(*)"), Arel.sql("SUM(salary_records.amount)"),
        Arel.sql("AVG(salary_records.amount)"), Arel.sql("MIN(salary_records.amount)"),
        Arel.sql("MAX(salary_records.amount)")
      )
      medians = Median.call(@population.salaries, partition: [ "salary_records.currency_code" ])
      minor_units = Currency.where(code: rows.map(&:first)).pluck(:code, :minor_units).to_h

      by_currency = rows.map do |code, count, total, average, min, max|
        CurrencySummary.new(currency_code: code, minor_units: minor_units.fetch(code), employee_count: count,
          total: total, average: average, median: medians.fetch([ code ]), min: min, max: max)
      end

      in_scope = @population.employees.count
      Result.new(employees_in_scope: in_scope, employees_without_salary: in_scope - by_currency.sum(&:employee_count),
        by_currency: by_currency)
    end
  end
end
