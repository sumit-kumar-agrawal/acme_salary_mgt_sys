module Api
  # Offset pagination via Pagy with the API's own `meta` shape (docs/api-specification.md §2.3, BACKEND_PLAN.md L13).
  # page/per_page are validated by Api::QueryParams first, so Pagy never silently caps or defaults them.
  # A page past the end returns an empty list with correct meta (Pagy does not raise by default).
  module Pagination
    extend ActiveSupport::Concern
    include Api::QueryParams
    include Pagy::Method

    private

    # Returns the records for the requested page and sets @pagination_meta for the jbuilder partial.
    def paginate(scope)
      page = page_param
      per_page = per_page_param
      pagy, records = pagy(:offset, scope, limit: per_page, page: page)

      @pagination_meta = {
        page: page,
        per_page: per_page,
        total_count: pagy.count,
        total_pages: (pagy.count / per_page.to_f).ceil
      }
      records
    end
  end
end
