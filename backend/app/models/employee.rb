# An employee record (docs/database-design.md §3.5). Employees are never hard-deleted;
# termination is a status change (D13).
class Employee < ApplicationRecord
  EMPLOYEE_NUMBER_FORMAT = /\A[A-Z0-9-]+\z/

  belongs_to :country
  belongs_to :department

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
end
