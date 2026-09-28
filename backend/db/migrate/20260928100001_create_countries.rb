class CreateCountries < ActiveRecord::Migration[8.0]
  def change
    create_table :countries do |t|
      t.string :code, limit: 2, null: false   # ISO 3166-1 alpha-2, upper-case
      t.string :name, limit: 100, null: false

      t.timestamps
    end

    add_index :countries, :code, unique: true
    add_index :countries, :name, unique: true
  end
end
