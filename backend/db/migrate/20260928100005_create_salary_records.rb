class CreateSalaryRecords < ActiveRecord::Migration[8.0]
  def change
    create_table :salary_records do |t|
      t.bigint :employee_id, null: false
      t.decimal :amount, precision: 18, scale: 4, null: false   # monthly gross base pay (D3)
      t.string :currency_code, limit: 3, null: false
      t.date :effective_from, null: false
      t.date :effective_to                                        # NULL = open-ended
      # 1 for the open-ended record, NULL otherwise; the unique index below allows one open record per employee (I9).
      t.virtual :open_flag, type: :integer, limit: 1, as: "IF(effective_to IS NULL, 1, NULL)", stored: true

      t.timestamps
    end

    # Indexes before foreign keys so MySQL reuses them instead of creating extra FK indexes.
    add_index :salary_records, [ :employee_id, :effective_from ], unique: true   # I8; also serves history lookups
    add_index :salary_records, [ :employee_id, :open_flag ], unique: true        # I9
    add_index :salary_records, :currency_code

    add_foreign_key :salary_records, :employees, on_delete: :restrict
    add_foreign_key :salary_records, :currencies, column: :currency_code, primary_key: :code, on_delete: :restrict

    add_check_constraint :salary_records, "amount > 0", name: "salary_records_amount_positive"
    add_check_constraint :salary_records, "effective_to IS NULL OR effective_to >= effective_from",
      name: "salary_records_period_order"
  end
end
