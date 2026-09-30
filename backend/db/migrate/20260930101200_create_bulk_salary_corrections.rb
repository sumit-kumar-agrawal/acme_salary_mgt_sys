# History of bulk salary correction uploads (BulkProcessor). The uploaded file and the failed-rows file
# are Active Storage attachments; salary values are never stored in this table.
class CreateBulkSalaryCorrections < ActiveRecord::Migration[8.0]
  def change
    create_table :bulk_salary_corrections do |t|
      t.references :user, null: false, foreign_key: true
      t.string :status, limit: 30, null: false, default: "processing"
      t.string :file_format, limit: 10, null: false
      t.string :original_filename, null: false
      t.integer :total_rows, :updated_rows, :unchanged_rows, :failed_rows, null: false, default: 0
      t.datetime :started_at
      t.datetime :finished_at
      t.timestamps

      t.index :created_at
      t.index :status
    end

    add_check_constraint :bulk_salary_corrections,
      "status IN ('processing', 'completed', 'completed_with_errors', 'failed')",
      name: "bulk_salary_corrections_status_valid"
    add_check_constraint :bulk_salary_corrections, "file_format IN ('csv', 'xlsx')",
      name: "bulk_salary_corrections_file_format_valid"
  end
end
