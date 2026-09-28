# One effective-dated monthly salary for an employee (docs/database-design.md §3.6, ADR 003).
# Records are written only through Salaries::ChangeService and Salaries::CorrectionService;
# the validations here are defence in depth behind the database constraints.
class SalaryRecord < ApplicationRecord
  belongs_to :employee
  belongs_to :currency, foreign_key: :currency_code, primary_key: :code, inverse_of: :salary_records

  attr_readonly :employee_id, :effective_from

  normalizes :currency_code, with: ->(code) { code.strip.upcase }

  validates :amount, presence: true, numericality: { greater_than: 0 }
  validates :effective_from, presence: true
  validates :effective_to, comparison: { greater_than_or_equal_to: :effective_from }, allow_nil: true, if: :effective_from
  validate :amount_fits_currency_minor_units
  validate :period_does_not_overlap
  validate :starts_on_or_after_hire_date

  # The record in effect on `date` (D7). Periods never overlap, so this is at most one row per employee.
  scope :in_effect_on, ->(date) {
    where("salary_records.effective_from <= :date AND " \
          "(salary_records.effective_to IS NULL OR salary_records.effective_to >= :date)", date: date)
  }
  scope :newest_first, -> { order(effective_from: :desc) }

  # "current", "scheduled" (starts after `date`), or "historical" (ended before `date`) — API spec §7.1.
  def status_on(date = Date.current)
    if effective_from > date
      "scheduled"
    elsif effective_to && effective_to < date
      "historical"
    else
      "current"
    end
  end

  # Current and scheduled records may be corrected; historical ones are immutable (D4 + O1).
  def editable?(date = Date.current)
    status_on(date) != "historical"
  end

  private

  # I5/J9: checked on the raw input, before the DECIMAL(18,4) type rounds it.
  def amount_fits_currency_minor_units
    return if amount.blank? || currency.nil?

    raw = BigDecimal(amount_before_type_cast.to_s, exception: false) || amount
    return if raw.round(currency.minor_units) == raw

    errors.add(:amount, :too_many_decimal_places,
      message: "must have at most #{currency.minor_units} decimal places for this currency")
  end

  # I10: no two periods of the same employee may overlap.
  def period_does_not_overlap
    return if employee_id.blank? || effective_from.blank?

    others = SalaryRecord.where(employee_id: employee_id).where.not(id: id)
      .where("effective_to IS NULL OR effective_to >= ?", effective_from)
    others = others.where(effective_from: ..effective_to) if effective_to
    return unless others.exists?

    errors.add(:effective_from, :overlaps_existing_period, message: "overlaps an existing salary period")
  end

  # I13: a salary cannot start before the employee was hired.
  def starts_on_or_after_hire_date
    hired_on = employee&.hired_on
    return if hired_on.blank? || effective_from.blank? || effective_from >= hired_on

    errors.add(:effective_from, :before_hire_date, message: "must not be before the employee's hire date")
  end
end
