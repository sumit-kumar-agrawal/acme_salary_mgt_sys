module Api
  module V1
    # GET/POST/DELETE /api/v1/session (docs/api-specification.md §4, ADR 004).
    class SessionsController < BaseController
      allow_unauthenticated_access only: %i[show create]

      rate_limit to: 5, within: 1.minute, only: :create,
        with: -> { render_error(:too_many_requests, "rate_limited", "Too many sign-in attempts. Try again later.") }

      def show
        render :show
      end

      # Same response for an unknown email and a wrong password; authenticate_by is timing-safe (L5).
      def create
        user = User.authenticate_by(email: params[:email].to_s, password: params[:password].to_s)
        return render_error(:unauthorized, "invalid_credentials", "Invalid email or password.") unless user

        start_session(user)
        render :show
      end

      def destroy
        end_session
        head :no_content
      end
    end
  end
end
