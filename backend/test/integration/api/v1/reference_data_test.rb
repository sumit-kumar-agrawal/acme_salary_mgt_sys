require "test_helper"

# GET /api/v1/countries, /departments, /currencies (docs/api-specification.md §5).
class Api::V1::ReferenceDataTest < ActionDispatch::IntegrationTest
  PATHS = %w[/api/v1/countries /api/v1/departments /api/v1/currencies].freeze

  test "reference lists require sign-in" do
    PATHS.each do |path|
      get path

      assert_response :unauthorized, path
      assert_equal "unauthenticated", json.dig("error", "code")
    end
  end

  test "countries are ordered by name with id, code, and name" do
    sign_in
    get api_v1_countries_path

    assert_response :ok
    assert_equal Country.order(:name).map { |c| { "id" => c.id, "code" => c.code, "name" => c.name } }, json["data"]
    assert_equal "France", json["data"].first["name"]
  end

  test "departments are ordered by name with id and name" do
    sign_in
    get api_v1_departments_path

    assert_equal Department.order(:name).map { |d| { "id" => d.id, "name" => d.name } }, json["data"]
  end

  test "currencies are ordered by code with name and minor units" do
    sign_in
    get api_v1_currencies_path

    assert_equal({ "code" => "EUR", "name" => "Euro", "minor_units" => 2 }, json["data"].first)
    assert_equal %w[EUR GBP INR JPY KWD SGD USD], json["data"].map { |c| c["code"] }
    assert_equal 0, json["data"].find { |c| c["code"] == "JPY" }["minor_units"]
  end

  test "reference lists are unpaginated and read-only" do
    sign_in
    get api_v1_countries_path, params: { page: 2, per_page: 1 }
    assert_equal 8, json["data"].size
    assert_nil json["meta"]

    [ [ :post, "/api/v1/countries" ], [ :patch, "/api/v1/currencies/USD" ], [ :delete, "/api/v1/departments/1" ] ].each do |verb, path|
      send(verb, path)
      assert_response :not_found, "#{verb.upcase} #{path}"
    end
  end
end
