json.error do
  json.code code
  json.message message
  json.details details if details.present?
end
