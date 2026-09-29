# Record-level salary report: one row per employee with a salary in effect on as_of
# (docs/api-specification.md §9, design §7.5, D19). The JSON report and the CSV export (5.3) share it,
# so displayed and exported rows are the same set. Inputs are validated by the controller.
class SalaryReportQuery
  SORTABLE = %w[employee_number last_name amount].freeze

  def initialize(population)
    @population = population
  end

  # sort: [field, :asc | :desc] with field in SORTABLE. Ties are broken by employee id (BACKEND_PLAN.md M9).
  def call(q: nil, sort: [ "employee_number", :asc ])
    relation = @population.salaries.preload(:currency, employee: %i[country department])
    relation = relation.merge(Employee.matching(q)) if q.present?
    order(relation, *sort)
  end

  private

  def order(relation, field, direction)
    employees = Employee.arel_table
    salaries = SalaryRecord.arel_table
    columns =
      case field
      when "employee_number" then [ employees[:employee_number].public_send(direction) ]
      when "last_name" then [ employees[:last_name].public_send(direction), employees[:first_name].public_send(direction) ]
      # Amounts are only comparable within a currency, so rows are grouped by currency first.
      when "amount" then [ salaries[:currency_code].asc, salaries[:amount].public_send(direction) ]
      else raise ArgumentError, "unsortable field: #{field}"
      end
    relation.order(*columns, employees[:id].asc)
  end
end
