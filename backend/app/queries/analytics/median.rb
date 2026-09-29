module Analytics
  # Median monthly amount per partition, computed in MySQL with window functions (D21, database design §7.2).
  # MySQL has no MEDIAN(): rows are ranked within each partition, and the middle row (odd count) or the
  # mean of the two middle rows (even count) is taken.
  #
  # `partition` lists SQL column expressions from fixed constants in the calling query, never user input.
  # The inner SQL comes from an ActiveRecord relation, so all filter values are already quoted.
  class Median
    def self.call(salaries, partition:)
      new(salaries, partition).call
    end

    def initialize(salaries, partition)
      @salaries = salaries
      @partition = partition
    end

    # Returns { [partition values...] => BigDecimal median }.
    def call
      ApplicationRecord.connection.select_rows(sql).to_h do |row|
        [ row[0...-1], BigDecimal(row.last.to_s) ]
      end
    end

    private

    def sql
      keys = @partition.each_index.map { |i| "p#{i}" }
      selected = @partition.each_with_index.map { |column, i| "#{column} AS p#{i}" }
      inner = @salaries.unscope(:order).select(*selected, "salary_records.amount AS amount").to_sql

      <<~SQL.squish
        WITH cur AS (#{inner}),
        ranked AS (
          SELECT #{keys.join(', ')}, amount,
                 ROW_NUMBER() OVER (PARTITION BY #{keys.join(', ')} ORDER BY amount) AS rn,
                 COUNT(*) OVER (PARTITION BY #{keys.join(', ')}) AS cnt
          FROM cur
        )
        SELECT #{keys.join(', ')}, AVG(amount) AS median
        FROM ranked
        WHERE rn IN (FLOOR((cnt + 1) / 2), CEIL((cnt + 1) / 2))
        GROUP BY #{keys.join(', ')}
      SQL
    end
  end
end
