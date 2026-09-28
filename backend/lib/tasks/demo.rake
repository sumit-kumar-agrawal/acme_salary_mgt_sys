# Synthetic demo data for development only (BACKEND_PLAN.md J6, docs/database-design.md §9).
namespace :demo do
  def demo_development_only!(task)
    abort "#{task} runs only in development (current: #{Rails.env})." unless Rails.env.development?
  end

  def demo_print_report(as_of:)
    check = Demo::IntegrityCheck.new
    check.summary(as_of: as_of).each { |key, value| puts "  #{key}: #{value}" }
    violations = check.violations
    violations.each { |key, count| puts "  #{key}: #{count}" }
    violations.values.all?(&:zero?)
  end

  desc "Load reference data and ~10,000 deterministic synthetic employees with salary histories (development only)"
  task seed: :environment do
    demo_development_only!("demo:seed")
    ReferenceData.seed!

    started = Process.clock_gettime(Process::CLOCK_MONOTONIC)
    Demo::Seeder.new.call
    elapsed = Process.clock_gettime(Process::CLOCK_MONOTONIC) - started

    puts "Demo data loaded in #{elapsed.round(1)}s (as of #{Demo::Seeder::AS_OF}):"
    demo_print_report(as_of: Demo::Seeder::AS_OF) || abort("Integrity violations found.")
  rescue Demo::Seeder::EmployeesExistError => e
    abort e.message
  end

  desc "Delete all employees and salary records, then run demo:seed (development only)"
  task reset: :environment do
    demo_development_only!("demo:reset")
    ActiveRecord::Base.transaction do
      SalaryRecord.delete_all
      Employee.delete_all
    end
    Rake::Task["demo:seed"].invoke
  end

  desc "Report counts and run the salary integrity checks against the current database (read-only)"
  task verify: :environment do
    puts "Integrity report (#{Rails.env}, as of #{Date.current}):"
    demo_print_report(as_of: Date.current) || abort("Integrity violations found.")
  end
end
