# Indexes kept after measurement on the 10k demo data (BACKEND_PLAN.md 6.2, N11; database design §13).
# Each removes a table scan and filesort with at least a 2x gain for its scenario:
# - hired_on, created_at: employee list sorted ascending by these fields (~6.3 ms -> ~2.3 ms).
# - (employment_status, country_id): employee list filtered by status and country (~12.1 ms -> ~4.6 ms).
# (effective_from, effective_to) was measured and not kept: analytics timings did not change.
class AddMeasuredIndexes < ActiveRecord::Migration[8.0]
  def change
    add_index :employees, :hired_on
    add_index :employees, :created_at
    add_index :employees, %i[employment_status country_id]
  end
end
