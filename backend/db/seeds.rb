# Reference data required in every environment (BACKEND_PLAN.md J6). Idempotent: safe to re-run,
# including in production. Synthetic demo employees are NOT created here; see `bin/rails demo:seed`
# (development only).
ReferenceData.seed!

puts "Reference data: #{Currency.count} currencies, #{Country.count} countries, #{Department.count} departments"
