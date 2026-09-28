module Api
  # Session-cookie authentication for the single HR user (ADR 004, architecture §5, BACKEND_PLAN.md L6).
  # Every API action requires a signed-in user unless the controller opts out with allow_unauthenticated_access.
  module Authentication
    extend ActiveSupport::Concern

    IDLE_TIMEOUT = 30.minutes
    ABSOLUTE_TIMEOUT = 8.hours

    included do
      before_action :require_login
      helper_method :current_user
    end

    class_methods do
      def allow_unauthenticated_access(**options)
        skip_before_action :require_login, **options
      end
    end

    private

    def current_user
      return @current_user if defined?(@current_user)

      @current_user = user_from_session
    end

    def require_login
      render_error(:unauthorized, "unauthenticated", "Please sign in.") unless current_user
    end

    # reset_session on login prevents session fixation.
    def start_session(user)
      reset_session
      now = Time.current.to_i
      session[:user_id] = user.id
      session[:signed_in_at] = now
      session[:last_seen_at] = now
      @current_user = user
    end

    def end_session
      reset_session
      @current_user = nil
    end

    def user_from_session
      return if session[:user_id].blank?

      now = Time.current.to_i
      if session_expired?(now)
        end_session
        return
      end

      session[:last_seen_at] = now
      User.find_by(id: session[:user_id])
    end

    def session_expired?(now)
      now - session[:last_seen_at].to_i > IDLE_TIMEOUT.to_i ||
        now - session[:signed_in_at].to_i > ABSOLUTE_TIMEOUT.to_i
    end
  end
end
