require "test_helper"

# Api::Pagination + Api::QueryParams + the meta partial (BACKEND_PLAN.md L12, L13).
# Tested without routes: `with_routing` in integration tests breaks route helpers for later test classes (Rails 8.0).
class Api::PaginationTest < ActiveSupport::TestCase
  class Host
    include Api::Pagination
    public :paginate

    attr_reader :params, :pagination_meta

    def initialize(values)
      @params = ActionController::Parameters.new(values)
    end

    # Pagy accepts a plain hash in place of a Rack request.
    def request
      { base_url: "http://example.test", path: "/api/v1/test", params: {} }
    end
  end

  def page_of(values = {}, scope: Country.order(:code))
    host = Host.new(values)
    [ host.paginate(scope).map(&:code), host.pagination_meta ]
  end

  test "returns the first page with default meta" do
    codes, meta = page_of

    assert_equal 8, codes.size
    assert_equal({ page: 1, per_page: 25, total_count: 8, total_pages: 1 }, meta)
  end

  test "slices pages and reports the last one" do
    codes, meta = page_of({ page: "3", per_page: "3" })

    assert_equal %w[SG US], codes
    assert_equal({ page: 3, per_page: 3, total_count: 8, total_pages: 3 }, meta)
  end

  test "a page past the end is empty with correct meta" do
    codes, meta = page_of({ page: "9", per_page: "3" })

    assert_equal [], codes
    assert_equal({ page: 9, per_page: 3, total_count: 8, total_pages: 3 }, meta)
  end

  test "an empty collection reports zero pages" do
    codes, meta = page_of(scope: Country.none)

    assert_equal [], codes
    assert_equal 0, meta[:total_pages]
  end

  test "invalid page or per_page raises BadRequest instead of being capped" do
    [ { per_page: "101" }, { per_page: "0" }, { page: "x" } ].each do |values|
      assert_raises(Api::BadRequest, values.inspect) { page_of(values) }
    end
  end

  test "the meta partial renders the documented keys" do
    rendered = Api::V1::BaseController.render(
      inline: 'json.meta { json.partial! "api/v1/shared/pagination_meta", meta: meta }',
      type: :jbuilder, locals: { meta: { page: 2, per_page: 3, total_count: 8, total_pages: 3 } }
    )

    assert_equal({ "meta" => { "page" => 2, "per_page" => 3, "total_count" => 8, "total_pages" => 3 } }, JSON.parse(rendered))
  end
end
