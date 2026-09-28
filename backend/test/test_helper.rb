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

    # Add more helper methods to be used by all tests here...
  end
end
