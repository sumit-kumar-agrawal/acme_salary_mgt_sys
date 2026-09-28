# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.0].define(version: 2026_09_28_100005) do
  create_table "countries", charset: "utf8mb4", collation: "utf8mb4_unicode_ci", force: :cascade do |t|
    t.string "code", limit: 2, null: false
    t.string "name", limit: 100, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["code"], name: "index_countries_on_code", unique: true
    t.index ["name"], name: "index_countries_on_name", unique: true
  end

  create_table "currencies", primary_key: "code", id: { type: :string, limit: 3 }, charset: "utf8mb4", collation: "utf8mb4_unicode_ci", force: :cascade do |t|
    t.string "name", limit: 64, null: false
    t.integer "minor_units", limit: 1, null: false, unsigned: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.check_constraint "`minor_units` between 0 and 4", name: "currencies_minor_units_range"
  end

  create_table "departments", charset: "utf8mb4", collation: "utf8mb4_unicode_ci", force: :cascade do |t|
    t.string "name", limit: 100, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["name"], name: "index_departments_on_name", unique: true
  end

  create_table "employees", charset: "utf8mb4", collation: "utf8mb4_unicode_ci", force: :cascade do |t|
    t.string "employee_number", limit: 20, null: false
    t.string "first_name", limit: 100, null: false
    t.string "last_name", limit: 100, null: false
    t.string "email"
    t.bigint "country_id", null: false
    t.bigint "department_id", null: false
    t.string "employment_status", limit: 20, default: "active", null: false
    t.date "hired_on"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["country_id"], name: "index_employees_on_country_id"
    t.index ["department_id"], name: "index_employees_on_department_id"
    t.index ["email"], name: "index_employees_on_email", unique: true
    t.index ["employee_number"], name: "index_employees_on_employee_number", unique: true
    t.index ["employment_status"], name: "index_employees_on_employment_status"
    t.index ["last_name", "first_name"], name: "index_employees_on_last_name_and_first_name"
    t.check_constraint "`employment_status` in (_utf8mb4'active',_utf8mb4'on_leave',_utf8mb4'terminated')", name: "employees_employment_status_valid"
  end

  create_table "salary_records", charset: "utf8mb4", collation: "utf8mb4_unicode_ci", force: :cascade do |t|
    t.bigint "employee_id", null: false
    t.decimal "amount", precision: 18, scale: 4, null: false
    t.string "currency_code", limit: 3, null: false
    t.date "effective_from", null: false
    t.date "effective_to"
    t.virtual "open_flag", type: :integer, limit: 1, as: "if((`effective_to` is null),1,NULL)", stored: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["currency_code"], name: "index_salary_records_on_currency_code"
    t.index ["employee_id", "effective_from"], name: "index_salary_records_on_employee_id_and_effective_from", unique: true
    t.index ["employee_id", "open_flag"], name: "index_salary_records_on_employee_id_and_open_flag", unique: true
    t.check_constraint "(`effective_to` is null) or (`effective_to` >= `effective_from`)", name: "salary_records_period_order"
    t.check_constraint "`amount` > 0", name: "salary_records_amount_positive"
  end

  add_foreign_key "employees", "countries"
  add_foreign_key "employees", "departments"
  add_foreign_key "salary_records", "currencies", column: "currency_code", primary_key: "code"
  add_foreign_key "salary_records", "employees"
end
