# The HR Manager login (ADR 004). Provisioned only by `bin/rails hr:create_user`; there is no sign-up.
class User < ApplicationRecord
  MINIMUM_PASSWORD_LENGTH = 12

  has_secure_password

  normalizes :email, with: ->(email) { email.strip.downcase }

  validates :email, presence: true, length: { maximum: 255 },
    format: { with: URI::MailTo::EMAIL_REGEXP }, uniqueness: { case_sensitive: false }
  validates :password, length: { minimum: MINIMUM_PASSWORD_LENGTH }, allow_nil: true
end
