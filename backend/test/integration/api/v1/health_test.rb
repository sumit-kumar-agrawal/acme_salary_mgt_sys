require "test_helper"

# GET /api/v1/health (docs/api-specification.md §3).
class Api::V1::HealthTest < ActionDispatch::IntegrationTest
  test "returns 200 with ok status when the database is reachable" do
    get api_v1_health_path

    assert_response :ok
    assert_equal "application/json", response.media_type
    assert_equal({ "data" => { "status" => "ok", "database" => "ok" } }, response.parsed_body)
  end

  test "returns 503 with unavailable database when the database check fails" do
    with_database_health(false) { get api_v1_health_path }

    assert_response :service_unavailable
    assert_equal({ "data" => { "status" => "error", "database" => "unavailable" } }, response.parsed_body)
  end

  test "exposes no version or environment details" do
    get api_v1_health_path

    assert_equal %w[data], response.parsed_body.keys
    assert_equal %w[database status], response.parsed_body["data"].keys.sort
  end

  private

  # minitest 6 no longer bundles minitest/mock, so swap the class method and restore it afterwards.
  def with_database_health(result)
    original = DatabaseHealth.method(:up?)
    DatabaseHealth.define_singleton_method(:up?) { result }
    yield
  ensure
    DatabaseHealth.define_singleton_method(:up?, original)
  end
end
