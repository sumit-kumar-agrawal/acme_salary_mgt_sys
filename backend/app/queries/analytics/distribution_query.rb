module Analytics
  # Ten fixed-width monthly-salary bands per currency between that currency's min and max
  # (docs/api-specification.md §8.3, design §7.3, BACKEND_PLAN.md M4).
  #
  # Band k covers [min + k·w, min + (k+1)·w) with w = (max − min) / 10; the last band also includes max.
  # The band index is counted with exact decimal comparisons, (amount − min)·10 >= k·(max − min) for
  # k = 1..9, instead of dividing by w, so MySQL's rounded decimal division cannot move an edge value.
  # When every amount is equal there is one band. Empty bands are returned with count 0.
  class DistributionQuery
    BANDS = 10

    CurrencyDistribution = Data.define(:currency_code, :minor_units, :employee_count, :bands)
    Band = Data.define(:lower, :upper, :count)

    BAND_INDEX = begin
      steps = (1...BANDS).map { |k| "((cur.amount - b.lo) * #{BANDS} >= (b.hi - b.lo) * #{k})" }
      "CASE WHEN b.hi = b.lo THEN 0 ELSE #{steps.join(' + ')} END"
    end.freeze

    def initialize(population)
      @population = population
    end

    def call
      bounds = @population.salaries.group(:currency_code).order(:currency_code).pluck(
        :currency_code, Arel.sql("MIN(salary_records.amount)"), Arel.sql("MAX(salary_records.amount)"),
        Arel.sql("COUNT(*)")
      )
      counts = band_counts
      minor_units = Currency.where(code: bounds.map(&:first)).pluck(:code, :minor_units).to_h

      bounds.map do |code, min, max, count|
        CurrencyDistribution.new(currency_code: code, minor_units: minor_units.fetch(code), employee_count: count,
          bands: bands(min, max) { |index| counts.fetch([ code, index ], 0) })
      end
    end

    private

    # { [currency_code, band_index] => count }
    def band_counts
      inner = @population.salaries.unscope(:order)
        .select("salary_records.currency_code AS currency_code", "salary_records.amount AS amount").to_sql

      sql = <<~SQL.squish
        WITH cur AS (#{inner}),
        b AS (SELECT currency_code, MIN(amount) AS lo, MAX(amount) AS hi FROM cur GROUP BY currency_code)
        SELECT cur.currency_code, #{BAND_INDEX} AS band, COUNT(*)
        FROM cur JOIN b ON b.currency_code = cur.currency_code
        GROUP BY cur.currency_code, band
      SQL
      ApplicationRecord.connection.select_rows(sql).to_h { |code, band, count| [ [ code, band.to_i ], count.to_i ] }
    end

    # Exact BigDecimal edges; rounding for display happens in the views.
    def bands(min, max)
      return [ Band.new(lower: min, upper: max, count: yield(0)) ] if min == max

      edges = (0..BANDS).map { |k| min + (max - min) * k / BANDS }
      (0...BANDS).map { |index| Band.new(lower: edges[index], upper: edges[index + 1], count: yield(index)) }
    end
  end
end
