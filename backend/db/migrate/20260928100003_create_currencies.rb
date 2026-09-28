class CreateCurrencies < ActiveRecord::Migration[8.0]
  def change
    # ISO 4217 code is the natural primary key (docs/database-design.md §3.4, J3).
    create_table :currencies, id: false do |t|
      t.string :code, limit: 3, null: false, primary_key: true
      t.string :name, limit: 64, null: false
      t.integer :minor_units, limit: 1, unsigned: true, null: false

      t.timestamps
    end

    add_check_constraint :currencies, "minor_units BETWEEN 0 AND 4", name: "currencies_minor_units_range"
  end
end
