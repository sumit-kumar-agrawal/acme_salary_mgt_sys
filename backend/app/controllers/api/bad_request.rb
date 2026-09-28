module Api
  # Raised for an invalid query parameter; rendered as 400 bad_request with `details`
  # (docs/api-specification.md §2.2, §10; BACKEND_PLAN.md L12).
  class BadRequest < StandardError
    attr_reader :details

    def initialize(parameter, message)
      @details = { parameter.to_s => [ message ] }
      super("#{parameter} #{message}")
    end
  end
end
