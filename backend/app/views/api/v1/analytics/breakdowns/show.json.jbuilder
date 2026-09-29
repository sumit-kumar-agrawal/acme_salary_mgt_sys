# Metrics per (country or department, currency) (docs/api-specification.md §8.4). dimension.code is
# present for countries only.
json.data do
  json.as_of @population.as_of
  json.period "monthly"
  json.by @by
  json.filters @population.filters
  json.rows @rows do |row|
    json.dimension do
      json.id row.dimension.id
      json.code row.dimension.code if row.dimension.code
      json.name row.dimension.name
    end
    json.currency_code row.currency_code
    json.employee_count row.employee_count
    %i[total average median].each { |metric| json.set! metric, money(row.public_send(metric), row.minor_units) }
  end
end
