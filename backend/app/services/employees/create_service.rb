module Employees
  # Creates an employee and, optionally, their first salary in one transaction (D14, API spec §6.3).
  # Salary errors are reported on the employee as "initial_salary.<attribute>"; on any failure nothing is saved.
  #
  # Returns the Employee: persisted on success, otherwise unsaved with errors.
  class CreateService
    def self.call(attributes:)
      new(attributes: attributes).call
    end

    def initialize(attributes:)
      @attributes = attributes.to_h.deep_symbolize_keys
      @salary_attributes = @attributes.delete(:initial_salary)
    end

    def call
      employee = Employee.new(@attributes)

      Employee.transaction do
        raise ActiveRecord::Rollback unless employee.save
        next if @salary_attributes.blank?

        salary = Salaries::ChangeService.call(employee: employee, attributes: @salary_attributes)
        next if salary.persisted?

        # import keeps the original error (type and message) without the employee having to
        # respond to "initial_salary.<attribute>" when messages are generated.
        salary.errors.each do |error|
          employee.errors.import(error, attribute: :"initial_salary.#{error.attribute}")
        end
        raise ActiveRecord::Rollback
      end

      employee
    end
  end
end
