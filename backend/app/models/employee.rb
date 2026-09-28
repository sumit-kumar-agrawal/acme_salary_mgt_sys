# An employee record (docs/database-design.md §3.5). Employees are never hard-deleted;
# termination is a status change (D13).
class Employee < ApplicationRecord
  EMPLOYEE_NUMBER_FORMAT = /\A[A-Z0-9-]+\z/

  belongs_to :country
  belongs_to :department
  has_many :salary_records, dependent: :restrict_with_exception

  enum :employment_status,
    { active: "active", on_leave: "on_leave", terminated: "terminated" },
    validate: true

  normalizes :employee_number, with: ->(number) { number.strip.upcase }
  normalizes :first_name, :last_name, with: ->(name) { name.strip }
  normalizes :email, with: ->(email) { email.strip.downcase.presence }

  validates :employee_number, presence: true, length: { maximum: 20 },
    format: { with: EMPLOYEE_NUMBER_FORMAT }, uniqueness: { case_sensitive: false }
  validates :first_name, :last_name, presence: true, length: { maximum: 100 }
  validates :email, length: { maximum: 255 }, format: { with: URI::MailTo::EMAIL_REGEXP },
    uniqueness: { case_sensitive: false }, allow_nil: true
  validate :hired_on_not_after_first_salary
  validate :hired_on_is_a_date

  # The salary record in effect on `date` (D7), or nil.
  def current_salary(date = Date.current)
    salary_records.in_effect_on(date).first
  end

  private

  # An unparseable date would otherwise be cast to nil and silently dropped.
  def hired_on_is_a_date
    return if hired_on.present? || hired_on_before_type_cast.blank?

    errors.add(:hired_on, :invalid, message: "must be a date in YYYY-MM-DD format")
  end

  # I13, employee side (J10): moving hired_on must not leave a salary starting before hire.
  def hired_on_not_after_first_salary
    return if new_record? || hired_on.blank? || !will_save_change_to_hired_on?

    first_start = salary_records.minimum(:effective_from)
    return if first_start.nil? || hired_on <= first_start

    errors.add(:hired_on, :after_first_salary, message: "must not be after the first salary start date")
  end
end
