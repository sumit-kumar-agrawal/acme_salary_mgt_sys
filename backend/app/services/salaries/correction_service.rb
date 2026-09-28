module Salaries
  # Corrects a data-entry error in a current or scheduled salary record (D4 + O1).
  # Only amount and currency may change; dates are immutable and historical records are rejected.
  #
  # Returns the SalaryRecord: updated on success, otherwise with errors
  # (`errors.of_kind?(:base, :not_editable)` marks a historical record).
  class CorrectionService
    CORRECTABLE = %i[amount currency_code].freeze
    IMMUTABLE = %i[employee_id effective_from effective_to].freeze

    def self.call(record:, attributes:)
      new(record: record, attributes: attributes).call
    end

    def initialize(record:, attributes:)
      @record = record
      @attributes = attributes.to_h.symbolize_keys
    end

    def call
      SalaryRecord.transaction(requires_new: true) do
        @record.employee.lock!
        @record.reload

        rejected = @attributes.keys & IMMUTABLE
        if rejected.any?
          rejected.each { |attribute| @record.errors.add(attribute, :immutable, message: "cannot be changed") }
          raise ActiveRecord::Rollback
        end

        unless @record.editable?
          @record.errors.add(:base, :not_editable, message: "Historical salary records cannot be changed")
          raise ActiveRecord::Rollback
        end

        @record.assign_attributes(@attributes.slice(*CORRECTABLE))
        raise ActiveRecord::Rollback unless @record.save
      end

      @record
    end
  end
end
