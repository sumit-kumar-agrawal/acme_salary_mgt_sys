module Api
  # Formatting for API views (docs/api-specification.md §1, BACKEND_PLAN.md L14).
  module FormattingHelper
    # Money as a decimal string with exactly the currency's minor units, e.g. "85000.00", "250000", "1500.125".
    # Uses BigDecimal rounding (half up); never goes through Float.
    def money(amount, minor_units)
      return if amount.nil?

      ActiveSupport::NumberHelper.number_to_rounded(BigDecimal(amount.to_s), precision: minor_units, round_mode: :half_up)
    end
  end
end
