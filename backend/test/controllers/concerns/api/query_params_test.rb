require "test_helper"

# Unit tests for list/filter parameter validation (BACKEND_PLAN.md L12, API spec §2.3, §2.4, §6.1).
class Api::QueryParamsTest < ActiveSupport::TestCase
  class Host
    include Api::QueryParams
    public(*Api::QueryParams.private_instance_methods)

    attr_reader :params

    def initialize(values)
      @params = ActionController::Parameters.new(values)
    end
  end

  def host(values = {})
    Host.new(values)
  end

  def assert_bad_request(parameter, &block)
    error = assert_raises(Api::BadRequest, &block)
    assert_equal [ parameter.to_s ], error.details.keys
    error
  end

  test "page and per_page default to 1 and 25" do
    assert_equal 1, host.page_param
    assert_equal 25, host.per_page_param
    assert_equal 25, host(per_page: "").per_page_param
  end

  test "page and per_page accept positive integers up to the per_page cap" do
    assert_equal 3, host(page: "3").page_param
    assert_equal 100, host(per_page: "100").per_page_param
    assert_equal 1, host(per_page: " 1 ").per_page_param
  end

  test "page and per_page reject zero, negatives, non-numbers, and per_page over 100" do
    [ "0", "-1", "abc", "1.5", "2e3" ].each do |value|
      assert_bad_request(:page) { host(page: value).page_param }
      assert_bad_request(:per_page) { host(per_page: value).per_page_param }
    end
    error = assert_bad_request(:per_page) { host(per_page: "101").per_page_param }
    assert_equal [ "must be at most 100" ], error.details["per_page"]
  end

  test "sort accepts allowlisted fields, ascending or descending" do
    allowed = %w[employee_number last_name]

    assert_equal [ "employee_number", :asc ], host.sort_param(allowed: allowed, default: "employee_number")
    assert_equal [ "last_name", :asc ], host(sort: "last_name").sort_param(allowed: allowed, default: "employee_number")
    assert_equal [ "last_name", :desc ], host(sort: "-last_name").sort_param(allowed: allowed, default: "employee_number")
  end

  test "sort rejects unknown fields and SQL fragments" do
    [ "salary", "last_name; DROP TABLE employees", "--last_name" ].each do |value|
      assert_bad_request(:sort) { host(sort: value).sort_param(allowed: %w[last_name], default: "last_name") }
    end
  end

  test "enum values must be one of the allowed values" do
    assert_equal "on_leave", host(employment_status: "on_leave").enum_param(:employment_status, %w[active on_leave])
    assert_nil host.enum_param(:employment_status, %w[active])
    assert_bad_request(:employment_status) { host(employment_status: "retired").enum_param(:employment_status, %w[active]) }
  end

  test "filter ids must be positive integers of existing records" do
    india = countries(:india)

    assert_equal india.id, host(country_id: india.id.to_s).id_param(:country_id, Country)
    [ "abc", "0", "-1" ].each do |value|
      assert_bad_request(:country_id) { host(country_id: value).id_param(:country_id, Country) }
    end
    error = assert_bad_request(:country_id) { host(country_id: "999999999").id_param(:country_id, Country) }
    assert_equal [ "does not match an existing country" ], error.details["country_id"]
  end

  test "strings are limited in length" do
    assert_equal "rao", host(q: " rao ").string_param(:q, max: 100)
    assert_equal "a" * 100, host(q: "a" * 100).string_param(:q, max: 100)
    assert_bad_request(:q) { host(q: "a" * 101).string_param(:q, max: 100) }
  end

  test "dates must be real YYYY-MM-DD dates" do
    assert_equal Date.new(2026, 9, 28), host(as_of: "2026-09-28").date_param(:as_of)
    [ "28-09-2026", "2026-02-30", "2026-9-28", "yesterday", "2026-09-28T00:00:00Z" ].each do |value|
      assert_bad_request(:as_of) { host(as_of: value).date_param(:as_of) }
    end
  end

  test "array or hash values are rejected" do
    assert_bad_request(:sort) { host(sort: [ "last_name" ]).sort_param(allowed: %w[last_name], default: "last_name") }
    assert_bad_request(:page) { host(page: { "x" => "1" }).page_param }
  end
end
