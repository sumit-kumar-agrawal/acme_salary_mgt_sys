require "test_helper"
require "rake"

class DemoRakeTest < ActiveSupport::TestCase
  setup do
    Rails.application.load_tasks unless Rake::Task.task_defined?("demo:seed")
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
