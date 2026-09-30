class SimplifyBulkSalaryCorrections < ActiveRecord::Migration[8.0]
  def up
    remove_check_constraint :bulk_salary_corrections, name: "bulk_salary_corrections_status_valid"
    execute "UPDATE bulk_salary_corrections SET status = 'process' WHERE status = 'processing'"
    execute "UPDATE bulk_salary_corrections SET status = 'completed_with_errors' WHERE status IN ('failed', 'interrupted')"
    change_column_default :bulk_salary_corrections, :status, from: "processing", to: "process"
    add_check_constraint :bulk_salary_corrections, "status IN ('process', 'completed', 'completed_with_errors')",
      name: "bulk_salary_corrections_status_valid"
    remove_columns :bulk_salary_corrections, :total_rows, :created_rows, :updated_rows, :unchanged_rows, :failed_rows
    execute "UPDATE active_storage_attachments SET name = 'response_file' WHERE record_type = 'BulkSalaryCorrection' AND name = 'failed_rows_file'"
  end

  def down
    remove_check_constraint :bulk_salary_corrections, name: "bulk_salary_corrections_status_valid"
    execute "UPDATE bulk_salary_corrections SET status = 'processing' WHERE status = 'process'"
    change_column_default :bulk_salary_corrections, :status, from: "process", to: "processing"
    add_check_constraint :bulk_salary_corrections,
      "status IN ('processing', 'completed', 'completed_with_errors', 'failed', 'interrupted')",
      name: "bulk_salary_corrections_status_valid"
    # Removed counts cannot be recovered; rollback restores the columns with zero defaults.
    %i[total_rows created_rows updated_rows unchanged_rows failed_rows].each do |column|
      add_column :bulk_salary_corrections, column, :integer, null: false, default: 0
    end
    execute "UPDATE active_storage_attachments SET name = 'failed_rows_file' WHERE record_type = 'BulkSalaryCorrection' AND name = 'response_file'"
  end
end
