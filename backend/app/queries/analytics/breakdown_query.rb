module Analytics
  # Monthly count, total, average, and median per (country or department, currency)
  # (docs/api-specification.md §8.4, design §7.4, BACKEND_PLAN.md M5). Rows are keyed by dimension *and*
  # currency, so an employee paid in USD in Germany counts in Germany/USD (D11). Ordered by dimension
  # name, then currency code.
  class BreakdownQuery
    # `by` maps to fixed columns; user input never reaches SQL.
    DIMENSIONS = {
      "country" => { column: "employees.country_id", model: Country },
      "department" => { column: "employees.department_id", model: Department }
    }.freeze

    Row = Data.define(:dimension, :currency_code, :minor_units, :employee_count, :total, :average, :median)
    Dimension = Data.define(:id, :code, :name)

    def initialize(population, by:)
      @population = population
      @dimension = DIMENSIONS.fetch(by) { raise ArgumentError, "unknown breakdown dimension: #{by}" }
    end

    def call
      column = @dimension[:column]
      aggregates = @population.salaries.group(Arel.sql(column), :currency_code).pluck(
        Arel.sql(column), :currency_code, Arel.sql("COUNT(*)"), Arel.sql("SUM(salary_records.amount)"),
        Arel.sql("AVG(salary_records.amount)")
      )
      medians = Median.call(@population.salaries, partition: [ column, "salary_records.currency_code" ])
      dimensions = dimensions_by_id(aggregates.map(&:first).uniq)
      minor_units = Currency.where(code: aggregates.map(&:second).uniq).pluck(:code, :minor_units).to_h

      rows = aggregates.map do |id, code, count, total, average|
        Row.new(dimension: dimensions.fetch(id), currency_code: code, minor_units: minor_units.fetch(code),
          employee_count: count, total: total, average: average, median: medians.fetch([ id, code ]))
      end
      rows.sort_by { |row| [ row.dimension.name, row.currency_code ] }
    end

    private

    # Countries have a code; departments do not.
    def dimensions_by_id(ids)
      @dimension[:model].where(id: ids).to_h do |record|
        [ record.id, Dimension.new(id: record.id, code: record.try(:code), name: record.name) ]
      end
    end
  end
end
