class Department < ApplicationRecord
  has_many :employees, dependent: :restrict_with_exception

  normalizes :name, with: ->(name) { name.strip }

  validates :name, presence: true, length: { maximum: 100 }, uniqueness: { case_sensitive: false }
end
