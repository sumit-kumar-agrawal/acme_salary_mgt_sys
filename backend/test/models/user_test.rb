require "test_helper"

class UserTest < ActiveSupport::TestCase
  test "normalizes email and requires it to be unique, ignoring case" do
    user = create(:user, email: " HR@Example.TEST ")

    assert_equal "hr@example.test", user.email
    duplicate = build(:user, email: "hr@EXAMPLE.test")
    assert_not duplicate.valid?
    assert duplicate.errors.of_kind?(:email, :taken)
  end

  test "requires a password of at least 12 characters" do
    assert_not build(:user, password: "short-pass1").valid?
    assert build(:user, password: "twelve-chars").valid?
    assert_not build(:user, password: nil).valid?
  end

  test "stores only a password digest" do
    user = create(:user, password: "correct-horse-battery")

    assert_not_equal "correct-horse-battery", user.password_digest
    assert user.authenticate("correct-horse-battery")
  end

  test "authenticate_by matches email case-insensitively and rejects wrong or blank passwords" do
    user = create(:user, email: "hr@example.test", password: "correct-horse-battery")

    assert_equal user, User.authenticate_by(email: "HR@example.test", password: "correct-horse-battery")
    assert_nil User.authenticate_by(email: "hr@example.test", password: "wrong-password-123")
    assert_nil User.authenticate_by(email: "hr@example.test", password: "")
    assert_nil User.authenticate_by(email: "nobody@example.test", password: "correct-horse-battery")
  end

  test "database rejects a duplicate email when validations are bypassed" do
    create(:user, email: "hr@example.test")

    assert_raises(ActiveRecord::RecordNotUnique) do
      User.insert_all!([ { email: "hr@example.test", password_digest: "x" } ])
    end
  end
end
