class CreateDepartments < ActiveRecord::Migration[8.0]
  def change
    create_table :departments do |t|
      t.string :name, limit: 100, null: false

      t.timestamps
    end

    add_index :departments, :name, unique: true
  end
end
