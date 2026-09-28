require "test_helper"

class HrRakeTest < ActiveSupport::TestCase
  VARIABLES = %w[HR_USER_EMAIL HR_USER_PASSWORD RESET_PASSWORD].freeze

  setup do
    ActiveSupport::TestCase.load_rake_tasks_once
    @saved_env = VARIABLES.to_h { |name| [ name, ENV[name] ] }
    VARIABLES.each { |name| ENV.delete(name) }
  end

  teardown { @saved_env.each { |name, value| ENV[name] = value } }

  def run_task(env)
    env.each { |name, value| ENV[name] = value }
    capture_io { Rake::Task["hr:create_user"].execute }
  end

  test "creates the HR user from the environment" do
    out, = run_task("HR_USER_EMAIL" => "HR@Example.test", "HR_USER_PASSWORD" => "correct-horse-battery")

    user = User.find_by!(email: "hr@example.test")
    assert user.authenticate("correct-horse-battery")
    assert_includes out, "created"
    assert_not_includes out, "correct-horse-battery"
  end

  test "refuses to overwrite an existing user unless RESET_PASSWORD=1" do
    create(:user, email: "hr@example.test", password: "correct-horse-battery")

    assert_raises(SystemExit) { run_task("HR_USER_EMAIL" => "hr@example.test", "HR_USER_PASSWORD" => "another-long-password") }
    assert User.find_by!(email: "hr@example.test").authenticate("correct-horse-battery")

    run_task("RESET_PASSWORD" => "1")
    assert User.find_by!(email: "hr@example.test").authenticate("another-long-password")
  end

  test "refuses a missing or too-short password" do
    assert_raises(SystemExit) { run_task("HR_USER_EMAIL" => "hr@example.test") }
    assert_raises(SystemExit) { run_task("HR_USER_PASSWORD" => "short") }
    assert_equal 0, User.count
  end
end
