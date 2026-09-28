json.data do
  json.authenticated current_user.present?
  if current_user
    json.user { json.email current_user.email }
  else
    json.user nil
  end
  json.csrf_token form_authenticity_token
end
