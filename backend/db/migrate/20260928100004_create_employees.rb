class CreateEmployees < ActiveRecord::Migration[8.0]
  def change
    create_table :employees do |t|
      t.string :employee_number, limit: 20, null: false
      t.string :first_name, limit: 100, null: false
      t.string :last_name, limit: 100, null: false
      t.string :email
      t.references :country, null: false, foreign_key: { on_delete: :restrict }
      t.references :department, null: false, foreign_key: { on_delete: :restrict }
      t.string :employment_status, limit: 20, null: false, default: "active"
      t.date :hired_on

      t.timestamps
    end

    add_index :employees, :employee_number, unique: true
    add_index :employees, :email, unique: true   # multiple NULLs allowed
    add_index :employees, :employment_status
    add_index :employees, [ :last_name, :first_name ]

    add_check_constraint :employees,
      "employment_status IN ('active', 'on_leave', 'terminated')",
      name: "employees_employment_status_valid"
  end
end
