module Api
  module V1
    # Public liveness and database check (docs/api-specification.md §3).
    # Inherits ActionController::API: no session, CSRF, or authentication (E7).
    class HealthController < ActionController::API
      def show
        @database_up = DatabaseHealth.up?
        render :show, status: @database_up ? :ok : :service_unavailable
      end
    end
  end
end
