json.data do
  json.status @database_up ? "ok" : "error"
  json.database @database_up ? "ok" : "unavailable"
end
