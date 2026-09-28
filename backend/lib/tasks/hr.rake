# Provision the single HR Manager login from the environment (ADR 004, BACKEND_PLAN.md L4).
namespace :hr do
  desc "Create the HR user from HR_USER_EMAIL and HR_USER_PASSWORD (RESET_PASSWORD=1 updates an existing user's password)"
  task create_user: :environment do
    email = ENV["HR_USER_EMAIL"].to_s.strip
    password = ENV["HR_USER_PASSWORD"].to_s
    abort "Set HR_USER_EMAIL and HR_USER_PASSWORD (for example in backend/.env)." if email.empty? || password.empty?

    user = User.find_by(email: email)
    if user && ENV["RESET_PASSWORD"] != "1"
      abort "HR user #{user.email} already exists. Set RESET_PASSWORD=1 to change its password."
    end

    created = user.nil?
    user ||= User.new(email: email)
    user.password = password
    abort "HR user not saved: #{user.errors.full_messages.to_sentence}" unless user.save

    puts "HR user #{user.email} #{created ? 'created' : 'password updated'}."
  end
end
