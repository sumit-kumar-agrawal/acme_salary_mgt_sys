require "test_helper"

# Error envelope and catch-all behaviour (docs/api-specification.md §2.2, §10; BACKEND_PLAN.md L9–L11).
class Api::V1::ErrorHandlingTest < ActionDispatch::IntegrationTest
  test "unknown /api/v1 paths return a JSON 404 for any method, even when signed out" do
    [ [ :get, "/api/v1/unknown" ], [ :post, "/api/v1/nope/deeper" ], [ :delete, "/api/v1" ],
      [ :get, "/api/v1/unknown.html" ] ].each do |verb, path|
      send(verb, path)

      assert_response :not_found, "#{verb.upcase} #{path}"
      assert_equal "application/json", response.media_type, "#{verb.upcase} #{path} must not render HTML"
      assert_equal({ "code" => "not_found", "message" => "Not found." }, json["error"])
    end
  end

  test "malformed JSON bodies return 400 bad_request" do
    post api_v1_session_path, params: '{"email": "hr@example.test", ', headers: { "CONTENT_TYPE" => "application/json" }

    assert_response :bad_request
    assert_equal "bad_request", json.dig("error", "code")
  end

  # Makes a real endpoint (GET /countries) fail unexpectedly, then restores it. No with_routing:
  # in Rails 8.0 it breaks route helpers for integration tests that run afterwards.
  def with_failing_countries_query
    original = Country.method(:order)
    Country.define_singleton_method(:order) { |*| raise "secret detail that must not leak" }
    yield
  ensure
    Country.singleton_class.remove_method(:order)
    raise "Country.order was not restored" unless Country.method(:order) == original
  end

  test "unexpected errors become a generic 500 envelope when enabled" do
    original = Rails.configuration.x.api_rescue_unexpected_errors
    Rails.configuration.x.api_rescue_unexpected_errors = true
    sign_in

    with_failing_countries_query { get api_v1_countries_path }

    assert_response :internal_server_error
    assert_equal({ "code" => "internal_error", "message" => "Something went wrong." }, json["error"])
    assert_not_includes response.body, "secret detail"
  ensure
    Rails.configuration.x.api_rescue_unexpected_errors = original
  end

  test "unexpected errors raise in tests by default so failures are visible" do
    sign_in

    with_failing_countries_query do
      assert_raises(RuntimeError) { get api_v1_countries_path }
    end
  end
end
