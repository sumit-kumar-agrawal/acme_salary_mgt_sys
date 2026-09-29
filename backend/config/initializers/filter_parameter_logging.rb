# Be sure to restart your server when you modify this file.

# Configure parameters to be partially matched (e.g. passw matches password) and filtered from the log file.
# Use this to limit dissemination of sensitive information.
# See the ActiveSupport::ParameterFilter documentation for supported notations and behaviors.
Rails.application.config.filter_parameters += [
  :passw, :email, :secret, :token, :_key, :crypt, :salt, :certificate, :otp, :ssn, :cvv, :cvc,
  # Salary and personal data (docs/architecture.md). "passw" and "token" already cover password and csrf_token.
  :amount, :salary, :first_name, :last_name,
  # Search input is often a name (BACKEND_PLAN.md N7). Exact match: a bare :q would filter every key containing "q".
  /\Aq\z/
]
