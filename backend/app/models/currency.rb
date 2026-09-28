# ISO 4217 currency; `code` is the primary key (docs/database-design.md §3.4).
class Currency < ApplicationRecord
  self.primary_key = "code"

  normalizes :code, with: ->(code) { code.strip.upcase }
  normalizes :name, with: ->(name) { name.strip }

  validates :code, presence: true, format: { with: /\A[A-Z]{3}\z/ }, uniqueness: { case_sensitive: false }
  validates :name, presence: true, length: { maximum: 64 }
  validates :minor_units, presence: true, numericality: { only_integer: true, in: 0..4 }
end
