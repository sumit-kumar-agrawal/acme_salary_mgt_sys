module Api
  module V1
    # Catch-all for unknown /api/v1 paths so the API never renders an HTML error page (BACKEND_PLAN.md L10).
    class NotFoundController < BaseController
      allow_unauthenticated_access
      skip_forgery_protection

      def show
        render_not_found
      end
    end
  end
end
