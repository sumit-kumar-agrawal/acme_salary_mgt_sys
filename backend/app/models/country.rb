class Country < ApplicationRecord
  has_many :employees, dependent: :restrict_with_exception

  normalizes :code, with: ->(code) { code.strip.upcase }
  normalizes :name, with: ->(name) { name.strip }

  validates :code, presence: true, format: { with: /\A[A-Z]{2}\z/ }, uniqueness: { case_sensitive: false }
  validates :name, presence: true, length: { maximum: 100 }, uniqueness: { case_sensitive: false }
end
