# Ten fixed-width bands per currency (docs/api-specification.md §8.3). Band edges are exact in the query
# and rounded here for display only; each band includes lower and excludes upper, except the last.
json.data do
  json.as_of @population.as_of
  json.period "monthly"
  json.filters @population.filters
  json.by_currency @distribution do |row|
    json.currency_code row.currency_code
    json.employee_count row.employee_count
    json.bands row.bands do |band|
      json.lower money(band.lower, row.minor_units)
      json.upper money(band.upper, row.minor_units)
      json.count band.count
    end
  end
end
