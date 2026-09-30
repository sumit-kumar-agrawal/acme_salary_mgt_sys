class ExtendBulkImportOutcomes < ActiveRecord::Migration[8.0]
  def up
    add_column :bulk_salary_corrections, :created_rows, :integer, null: false, default: 0
    remove_check_constraint :bulk_salary_corrections, name: "bulk_salary_corrections_status_valid"
    add_check_constraint :bulk_salary_corrections,
      "status IN ('processing', 'completed', 'completed_with_errors', 'failed', 'interrupted')",
      name: "bulk_salary_corrections_status_valid"
  end

  def down
    execute "UPDATE bulk_salary_corrections SET status = 'failed' WHERE status = 'interrupted'"
    remove_check_constraint :bulk_salary_corrections, name: "bulk_salary_corrections_status_valid"
    add_check_constraint :bulk_salary_corrections,
      "status IN ('processing', 'completed', 'completed_with_errors', 'failed')",
      name: "bulk_salary_corrections_status_valid"
    remove_column :bulk_salary_corrections, :created_rows
  end
end
