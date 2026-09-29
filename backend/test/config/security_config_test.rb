require "test_helper"

# Production security settings that the test environment cannot exercise directly
# (ADR 004, architecture §5, §7, §9; BACKEND_PLAN.md N7, N15).
class SecurityConfigTest < ActiveSupport::TestCase
  SESSION_STORE = Rails.root.join("config/initializers/session_store.rb")

  # Re-evaluates the session initializer as production would, then restores the test settings.
  def session_options_in(environment)
    original_env = Rails.env
    original_store = Rails.application.config.session_store
    original_options = Rails.application.config.session_options
    Rails.env = environment
    load SESSION_STORE
    Rails.application.config.session_options.dup
  ensure
    Rails.env = original_env
    Rails.application.config.session_store(original_store, **original_options)
  end

  test "the production session cookie is Secure, HttpOnly, and SameSite=Lax" do
    options = session_options_in("production")

    assert_equal [ true, true, :lax, "_acme_salary_session" ], options.values_at(:secure, :httponly, :same_site, :key)
  end

  test "the session cookie is not Secure in test, so plain-HTTP tests keep working" do
    assert_equal false, Rails.application.config.session_options[:secure]
  end

  test "production forces SSL and logs at info unless overridden" do
    production = Rails.root.join("config/environments/production.rb").read

    assert_match(/^\s*config\.force_ssl = true/, production)
    assert_match(/^\s*config\.assume_ssl = true/, production)
    assert_match(/config\.log_level = ENV\.fetch\("RAILS_LOG_LEVEL", "info"\)/, production)
  end

  test "q is filtered exactly; other keys containing q are not" do
    filter = ActiveSupport::ParameterFilter.new(Rails.application.config.filter_parameters)

    filtered = filter.filter("q" => "Garcia", "sequence" => "1", "employee_number" => "EMP-1", "amount" => "1.00")
    assert_equal({ "q" => "[FILTERED]", "sequence" => "1", "employee_number" => "EMP-1", "amount" => "[FILTERED]" }, filtered)
  end

  test "model inspect output redacts personal and salary attributes" do
    employee = Employee.new(first_name: "Zenobia", last_name: "Quartermaine", email: "zenobia.q@example.test")
    salary = SalaryRecord.new(amount: "123456.78")

    [ employee.inspect, salary.inspect ].each do |text|
      %w[Zenobia Quartermaine zenobia.q@example.test 123456.78].each { |value| assert_not_includes text, value }
    end
    assert_includes employee.inspect, "first_name: [FILTERED]"
  end
end
