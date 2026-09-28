# Synthetic employees. Reference data comes from fixtures (J1), so factories look it up rather than create it.
FactoryBot.define do
  factory :employee do
    sequence(:employee_number) { |n| format("EMP-%05d", n) }
    first_name { Faker::Name.first_name }
    last_name { Faker::Name.last_name }
    sequence(:email) { |n| "employee#{n}@example.test" }
    country { Country.find_by!(code: "IN") }
    department { Department.find_by!(name: "Engineering") }
    employment_status { "active" }
    hired_on { Date.new(2021, 4, 12) }
  end
end
