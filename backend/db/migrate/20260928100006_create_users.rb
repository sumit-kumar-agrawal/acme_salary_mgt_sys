class CreateUsers < ActiveRecord::Migration[8.0]
  def change
    # The single HR Manager login (docs/database-design.md §3.1, ADR 004).
    create_table :users do |t|
      t.string :email, null: false
      t.string :password_digest, null: false

      t.timestamps
    end

    add_index :users, :email, unique: true
  end
end
