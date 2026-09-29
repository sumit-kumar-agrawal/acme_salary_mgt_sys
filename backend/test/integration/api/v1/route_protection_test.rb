require "test_helper"

# Walks every /api/v1 route in the route table (BACKEND_PLAN.md N3, N4), so a route added later without
# the default-deny base controller or CSRF protection fails here without a new test being written.
class Api::V1::RouteProtectionTest < ActionDispatch::IntegrationTest
  # Public by design (API spec §1): health, session state, and sign-in.
  PUBLIC = [ %w[GET /api/v1/health], %w[GET /api/v1/session], %w[POST /api/v1/session] ].freeze
  # A walk that finds fewer routes than the documented set would pass vacuously.
  DOCUMENTED = [
    %w[GET /api/v1/employees], %w[POST /api/v1/employees], %w[PATCH /api/v1/employees/1],
    %w[POST /api/v1/employees/1/salary_records], %w[PATCH /api/v1/employees/1/salary_records/1],
    %w[GET /api/v1/countries], %w[GET /api/v1/analytics/summary], %w[GET /api/v1/reports/salaries],
    %w[DELETE /api/v1/session]
  ].freeze
  STATE_CHANGING = %w[POST PATCH PUT DELETE].freeze

  # [verb, path] for every API route except the catch-all, with :params replaced by 1.
  def self.api_routes
    Rails.application.routes.routes.filter_map do |route|
      path = route.path.spec.to_s.delete_suffix("(.:format)")
      next unless path.start_with?("/api/v1") && route.verb.present?
      next if route.requirements[:controller] == "api/v1/not_found"

      [ route.verb, path.gsub(/:\w+/, "1") ]
    end.uniq
  end

  def request_as(verb, path, headers: {})
    process(verb.downcase.to_sym, path, headers: headers, as: (:json unless verb == "GET"))
  end

  test "the walk covers the documented routes" do
    walked = self.class.api_routes
    assert_empty DOCUMENTED - walked
    assert_empty PUBLIC - walked
  end

  test "every non-public API route returns a JSON 401 without a session" do
    (self.class.api_routes - PUBLIC).each do |verb, path|
      request_as(verb, path)

      assert_response :unauthorized, "#{verb} #{path}"
      assert_equal "application/json", response.media_type, "#{verb} #{path}"
      assert_equal "unauthenticated", json.dig("error", "code"), "#{verb} #{path}"
    end
  end

  class CsrfTest < ActionDispatch::IntegrationTest
    setup do
      @original = ActionController::Base.allow_forgery_protection
      ActionController::Base.allow_forgery_protection = true
      user = create(:user, password: TEST_PASSWORD)
      get api_v1_session_path
      post api_v1_session_path, params: { email: user.email, password: TEST_PASSWORD },
        headers: { "X-CSRF-Token" => json.dig("data", "csrf_token") }, as: :json
      assert_response :ok
      @token = json.dig("data", "csrf_token")
    end

    teardown { ActionController::Base.allow_forgery_protection = @original }

    # The session routes are left out of the "with token" walk (sign-in with no body fails, sign-out would end
    # the session); sessions_test.rb covers them with a token.
    def state_changing_routes
      Api::V1::RouteProtectionTest.api_routes.select { |verb, _| STATE_CHANGING.include?(verb) }
    end

    def request_as(verb, path, headers: {})
      process(verb.downcase.to_sym, path, headers: headers, as: :json)
    end

    test "every state-changing route rejects a request without a CSRF token" do
      assert_operator state_changing_routes.size, :>=, 7

      state_changing_routes.each do |verb, path|
        request_as(verb, path)

        assert_response :unprocessable_entity, "#{verb} #{path}"
        assert_equal "invalid_csrf_token", json.dig("error", "code"), "#{verb} #{path}"
      end
    end

    test "with the token, the CSRF check passes on every state-changing route" do
      state_changing_routes.reject { |_, path| path == "/api/v1/session" }.each do |verb, path|
        request_as(verb, path, headers: { "X-CSRF-Token" => @token })

        assert_not_equal "invalid_csrf_token", json.dig("error", "code"), "#{verb} #{path}"
        assert_not_equal 401, response.status, "#{verb} #{path} should still be signed in"
      end
    end
  end
end
