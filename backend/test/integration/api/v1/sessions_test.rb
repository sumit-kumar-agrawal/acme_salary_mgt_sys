require "test_helper"

# GET/POST/DELETE /api/v1/session (docs/api-specification.md §4, ADR 004).
class Api::V1::SessionsTest < ActionDispatch::IntegrationTest
  setup { @user = create(:user, email: "hr@example.test", password: TEST_PASSWORD) }

  def log_in(email: @user.email, password: TEST_PASSWORD, headers: {})
    post api_v1_session_path, params: { email: email, password: password }, headers: headers, as: :json
  end

  test "GET reports signed-out state with a CSRF token" do
    get api_v1_session_path

    assert_response :ok
    assert_equal false, json.dig("data", "authenticated")
    assert_nil json.dig("data", "user")
    assert json.dig("data", "csrf_token").present?
  end

  test "POST signs in and GET then reports the user" do
    log_in(email: "HR@Example.test")

    assert_response :ok
    assert_equal({ "authenticated" => true, "user" => { "email" => "hr@example.test" } },
      json["data"].except("csrf_token"))
    get api_v1_session_path
    assert_equal true, json.dig("data", "authenticated")
  end

  test "wrong password and unknown email get the same generic 401" do
    log_in(password: "wrong-password-123")
    wrong_password = [ response.status, json ]
    log_in(email: "nobody@example.test")

    assert_equal wrong_password, [ response.status, json ]
    assert_equal 401, response.status
    assert_equal({ "code" => "invalid_credentials", "message" => "Invalid email or password." }, json["error"])
    assert_not_includes response.body, "nobody@example.test"
  end

  test "signing in starts a new session (no fixation)" do
    get api_v1_session_path
    before = session.id.to_s

    log_in

    assert_not_equal before, session.id.to_s
  end

  test "DELETE signs out and protected actions then return 401" do
    log_in
    delete api_v1_session_path

    assert_response :no_content
    get api_v1_session_path
    assert_equal false, json.dig("data", "authenticated")

    delete api_v1_session_path
    assert_response :unauthorized
    assert_equal "unauthenticated", json.dig("error", "code")
  end

  test "protected actions are denied by default without a session" do
    delete api_v1_session_path

    assert_response :unauthorized
    assert_equal "application/json", response.media_type
    assert_equal({ "code" => "unauthenticated", "message" => "Please sign in." }, json["error"])
  end

  test "session expires after 30 minutes idle" do
    log_in

    travel 29.minutes
    get api_v1_session_path
    assert_equal true, json.dig("data", "authenticated"), "activity within 30 minutes keeps the session"

    travel 31.minutes
    get api_v1_session_path
    assert_equal false, json.dig("data", "authenticated")
  end

  test "session expires 8 hours after sign-in even when active" do
    log_in

    16.times do
      travel 25.minutes
      get api_v1_session_path
    end
    assert_equal true, json.dig("data", "authenticated"), "6h40m in, still signed in"

    4.times do
      travel 25.minutes
      get api_v1_session_path
    end
    assert_equal false, json.dig("data", "authenticated"), "past 8 hours the session ends"
  end

  test "more than 5 sign-in attempts per minute are rate limited" do
    5.times do
      log_in(password: "wrong-password-123")
      assert_response :unauthorized
    end

    log_in
    assert_response :too_many_requests
    assert_equal "rate_limited", json.dig("error", "code")

    travel 61.seconds
    log_in
    assert_response :ok
  end

  test "session cookie is HttpOnly and SameSite=Lax" do
    log_in

    cookie = Array(response.headers["Set-Cookie"]).join("\n")
    assert_match(/_acme_salary_session=/, cookie)
    assert_match(/httponly/i, cookie)
    assert_match(/samesite=lax/i, cookie)
  end

  test "sign-in failures do not log the password or email" do
    output = StringIO.new
    logger = ActiveSupport::Logger.new(output)
    original = Rails.logger
    Rails.logger = logger
    ActionController::Base.logger = logger
    log_in(password: "wrong-password-123")

    assert_not_includes output.string, "wrong-password-123"
    assert_not_includes output.string, @user.email
    assert_includes output.string, "[FILTERED]"
  ensure
    Rails.logger = original
    ActionController::Base.logger = original
  end

  class CsrfTest < ActionDispatch::IntegrationTest
    setup do
      @user = create(:user, password: TEST_PASSWORD)
      @original = ActionController::Base.allow_forgery_protection
      ActionController::Base.allow_forgery_protection = true
    end

    teardown { ActionController::Base.allow_forgery_protection = @original }

    test "state-changing requests without a CSRF token are rejected" do
      post api_v1_session_path, params: { email: @user.email, password: TEST_PASSWORD }, as: :json

      assert_response :unprocessable_entity
      assert_equal "invalid_csrf_token", json.dig("error", "code")
    end

    test "the token from GET /session, and the one returned at login, are accepted" do
      get api_v1_session_path
      post api_v1_session_path, params: { email: @user.email, password: TEST_PASSWORD },
        headers: { "X-CSRF-Token" => json.dig("data", "csrf_token") }, as: :json
      assert_response :ok

      delete api_v1_session_path, headers: { "X-CSRF-Token" => json.dig("data", "csrf_token") }
      assert_response :no_content
    end

    test "sign-out without a token is rejected" do
      get api_v1_session_path
      post api_v1_session_path, params: { email: @user.email, password: TEST_PASSWORD },
        headers: { "X-CSRF-Token" => json.dig("data", "csrf_token") }, as: :json

      delete api_v1_session_path
      assert_response :unprocessable_entity
      assert_equal "invalid_csrf_token", json.dig("error", "code")
    end
  end
end
