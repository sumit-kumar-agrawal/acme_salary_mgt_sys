module Api
  # Maps exceptions to the API error envelope (docs/api-specification.md §2.2, §10; architecture §6).
  # Messages are generic; submitted values and record data are never echoed.
  module ErrorHandling
    extend ActiveSupport::Concern

    included do
      # Declared first so the specific handlers below take precedence (Rails checks handlers last-to-first).
      rescue_from StandardError, with: :render_internal_error
      rescue_from ActionController::ParameterMissing, with: :render_missing_parameter
      rescue_from ActionDispatch::Http::Parameters::ParseError, with: :render_bad_request
      rescue_from Api::BadRequest, with: :render_invalid_parameter
      rescue_from ActiveRecord::RecordNotFound, with: :render_not_found
      rescue_from ActiveRecord::RecordInvalid, with: :render_record_invalid
      rescue_from ActiveRecord::RecordNotUnique, with: :render_record_not_unique
      rescue_from ActionController::InvalidAuthenticityToken, with: :render_invalid_csrf_token
    end

    private

    def render_error(status, code, message, details: nil)
      render template: "api/v1/shared/error", formats: :json, status: status,
        locals: { code: code, message: message, details: details }
    end

    def render_validation_errors(errors)
      render_error(:unprocessable_entity, "validation_failed", "Please correct the highlighted fields.",
        details: errors.to_hash)
    end

    def render_bad_request(_exception = nil)
      render_error(:bad_request, "bad_request", "The request is malformed.")
    end

    def render_missing_parameter(exception)
      render_error(:bad_request, "bad_request", "The request is malformed.",
        details: { exception.param.to_s => [ "is required" ] })
    end

    def render_invalid_parameter(exception)
      render_error(:bad_request, "bad_request", "The request is malformed.", details: exception.details)
    end

    def render_not_found(_exception = nil)
      render_error(:not_found, "not_found", "Not found.")
    end

    def render_record_invalid(exception)
      render_validation_errors(exception.record.errors)
    end

    # A request that passed the uniqueness validations but lost a race to the unique index
    # (database design §6, BACKEND_PLAN.md N5). MySQL's message contains the duplicate value, so only the
    # index name is inspected, and details are given only for known indexes.
    UNIQUE_INDEX_FIELDS = {
      "index_employees_on_employee_number" => "employee_number",
      "index_employees_on_email" => "email"
    }.freeze

    def render_record_not_unique(exception)
      field = UNIQUE_INDEX_FIELDS.find { |index, _| exception.message.include?(index) }&.last
      render_error(:unprocessable_entity, "validation_failed", "Please correct the highlighted fields.",
        details: field && { field => [ "has already been taken" ] })
    end

    def render_invalid_csrf_token(_exception = nil)
      render_error(:unprocessable_entity, "invalid_csrf_token", "Missing or invalid CSRF token.")
    end

    # L11: generic 500; the class and backtrace go to the log only (messages may contain data).
    def render_internal_error(exception)
      raise exception unless Rails.configuration.x.api_rescue_unexpected_errors

      Rails.logger.error("#{exception.class} in #{self.class.name}##{action_name}\n" \
                         "#{Array(exception.backtrace).first(10).join("\n")}")
      render_error(:internal_server_error, "internal_error", "Something went wrong.")
    end
  end
end
