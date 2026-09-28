ENV["RAILS_ENV"] ||= "test"
require_relative "../config/environment"
require "rails/test_help"

module ActiveSupport
  class TestCase
    # Parallel runs are off (BACKEND_PLAN.md K1): Rails 8.0's process workers are incompatible with
    # minitest 6 (workers die after the first test and the run hangs). Revisit after upgrading Rails.
    parallelize(workers: 1)

    # Setup all fixtures in test/fixtures/*.yml for all tests in alphabetical order.
    fixtures :all

    # FactoryBot for employees and salary records; fixtures hold reference data (BACKEND_PLAN.md J1).
    include FactoryBot::Syntax::Methods

    # Load the app's rake tasks once per test process (loading twice redefines constants and tasks).
    def self.load_rake_tasks_once
      return if defined?(@@rake_tasks_loaded)

      require "rake"
      Rails.application.load_tasks
      @@rake_tasks_loaded = true
    end

    # Add more helper methods to be used by all tests here...
  end
end

module ActionDispatch
  class IntegrationTest
    TEST_PASSWORD = "correct-horse-battery".freeze

    # The login rate limit counts in Rails.cache (memory store in test); start every test with a clean slate.
    setup { Rails.cache.clear }

    def sign_in(user = create(:user, password: TEST_PASSWORD), password: TEST_PASSWORD)
      post api_v1_session_path, params: { email: user.email, password: password }, as: :json
      assert_response :ok, "sign-in failed: #{response.body}"
      user
    end

    def json
      response.parsed_body
    end
  end
end
