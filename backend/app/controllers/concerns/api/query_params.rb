module Api
  # Validates list/filter query parameters before they reach queries or Pagy (BACKEND_PLAN.md L12).
  # Invalid values raise Api::BadRequest (400) instead of silently falling back to defaults (API spec §1).
  module QueryParams
    extend ActiveSupport::Concern

    DEFAULT_PER_PAGE = 25
    MAX_PER_PAGE = 100
    INTEGER_FORMAT = /\A\d+\z/
    DATE_FORMAT = /\A\d{4}-\d{2}-\d{2}\z/

    private

    def page_param
      positive_integer_param(:page, default: 1, max: nil)
    end

    def per_page_param
      positive_integer_param(:per_page, default: DEFAULT_PER_PAGE, max: MAX_PER_PAGE)
    end

    # "field" ascending, "-field" descending; only allowlisted fields. Returns [field, :asc | :desc].
    def sort_param(allowed:, default:)
      value = scalar_param(:sort)
      return [ default, :asc ] if value.nil?

      descending = value.start_with?("-")
      field = value.delete_prefix("-")
      raise BadRequest.new(:sort, "must be one of: #{allowed.join(', ')} (prefix with - to sort descending)") unless allowed.include?(field)

      [ field, descending ? :desc : :asc ]
    end

    def enum_param(name, allowed)
      value = scalar_param(name)
      return if value.nil?
      raise BadRequest.new(name, "must be one of: #{allowed.join(', ')}") unless allowed.include?(value)

      value
    end

    # Filter by id: must be a positive integer of an existing record, otherwise 400 (API spec §6.1).
    def id_param(name, model)
      value = scalar_param(name)
      return if value.nil?
      raise BadRequest.new(name, "must be a positive integer") unless INTEGER_FORMAT.match?(value) && value.to_i.positive?
      raise BadRequest.new(name, "does not match an existing #{model.model_name.human.downcase}") unless model.exists?(value.to_i)

      value.to_i
    end

    def string_param(name, max:)
      value = scalar_param(name)
      return if value.nil?
      raise BadRequest.new(name, "must be at most #{max} characters") if value.length > max

      value
    end

    def date_param(name)
      value = scalar_param(name)
      return if value.nil?

      date = Date.iso8601(value) if DATE_FORMAT.match?(value)
      date || raise(BadRequest.new(name, "must be a date in YYYY-MM-DD format"))
    rescue Date::Error
      raise BadRequest.new(name, "must be a date in YYYY-MM-DD format")
    end

    def positive_integer_param(name, default:, max:)
      value = scalar_param(name)
      return default if value.nil?

      number = value.to_i if INTEGER_FORMAT.match?(value)
      raise BadRequest.new(name, "must be a positive integer") unless number&.positive?
      raise BadRequest.new(name, "must be at most #{max}") if max && number > max

      number
    end

    # Blank values count as absent; arrays or hashes (e.g. ?sort[]=x) are rejected.
    def scalar_param(name)
      value = params[name]
      return if value.blank?
      raise BadRequest.new(name, "must be a single value") unless value.is_a?(String)

      value.strip
    end
  end
end
