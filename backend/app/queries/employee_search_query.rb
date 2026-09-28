# Employee list: search, filters, and allowlisted sorting (docs/api-specification.md §6.1, BACKEND_PLAN.md L15).
# Inputs are validated by the controller (Api::QueryParams); this class only builds the relation.
class EmployeeSearchQuery
  SORTABLE = %w[employee_number last_name hired_on created_at].freeze

  def initialize(scope = Employee.all)
    @scope = scope
  end

  # sort: [field, :asc | :desc] with field in SORTABLE. Ties are broken by id so pages are stable.
  def call(q: nil, country_id: nil, department_id: nil, employment_status: nil, sort: [ "employee_number", :asc ])
    relation = @scope.includes(:country, :department)
    relation = relation.where(country_id: country_id) if country_id
    relation = relation.where(department_id: department_id) if department_id
    relation = relation.where(employment_status: employment_status) if employment_status
    relation = search(relation, q) if q.present?
    order(relation, *sort)
  end

  private

  # Contains match; the utf8mb4_unicode_ci collation makes it case- and accent-insensitive.
  # LIKE wildcards in the input are escaped, so "%" and "_" match literally.
  def search(relation, q)
    pattern = "%#{Employee.sanitize_sql_like(q)}%"
    relation.where("employees.employee_number LIKE :pattern OR employees.first_name LIKE :pattern " \
                   "OR employees.last_name LIKE :pattern", pattern: pattern)
  end

  def order(relation, field, direction)
    raise ArgumentError, "unsortable field: #{field}" unless SORTABLE.include?(field)

    columns = { field => direction }
    columns[:first_name] = direction if field == "last_name"
    relation.order(columns.merge(id: :asc))
  end
end
