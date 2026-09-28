module Salaries
  # Records a salary change without overwriting history (ADR 003, docs/database-design.md §6):
  # lock the employee, reject a start date that is not after the latest record,
  # close the latest period on the day before, and insert the new open-ended record.
  #
  # Returns the new SalaryRecord: persisted on success, otherwise unsaved with errors.
  class ChangeService
    PERMITTED = %i[amount currency_code effective_from].freeze

    def self.call(employee:, attributes:)
      new(employee: employee, attributes: attributes).call
    end

    def initialize(employee:, attributes:)
      @employee = employee
      @attributes = attributes.to_h.symbolize_keys.slice(*PERMITTED)
    end

    def call
      record = SalaryRecord.new(@attributes.merge(employee: @employee))
      return record.tap(&:validate) if record.effective_from.blank?

      # requires_new: a savepoint, so a rollback here also works when called inside another transaction.
      SalaryRecord.transaction(requires_new: true) do
        @employee.lock!
        latest = @employee.salary_records.newest_first.first

        if latest && record.effective_from <= latest.effective_from
          record.errors.add(:effective_from, :not_after_latest,
            message: "must be after the latest salary record's start date")
          raise ActiveRecord::Rollback
        end

        close_period(latest, before: record.effective_from) if latest
        raise ActiveRecord::Rollback unless record.save
      end

      record
    end

    private

    def close_period(latest, before:)
      return if latest.effective_to && latest.effective_to < before

      latest.update!(effective_to: before - 1.day)
    end
  end
end
