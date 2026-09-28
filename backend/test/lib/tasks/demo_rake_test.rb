require "test_helper"

class DemoRakeTest < ActiveSupport::TestCase
  setup do
    ActiveSupport::TestCase.load_rake_tasks_once
  end

  %w[demo:seed demo:reset].each do |task_name|
    test "#{task_name} refuses to run outside development and changes nothing" do
      create(:employee)

      assert_no_difference -> { Employee.count } do
        assert_raises(SystemExit) { capture_io { Rake::Task[task_name].execute } }
      end
    end
  end
end
