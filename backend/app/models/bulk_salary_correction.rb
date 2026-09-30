# Upload history. Files are stored through Active Storage, not as columns in this table.
class BulkSalaryCorrection < ApplicationRecord
  belongs_to :user
  has_one_attached :original_file
  has_one_attached :response_file

  enum :status, { process: "process", completed: "completed", completed_with_errors: "completed_with_errors" }, validate: true
  validates :file_format, inclusion: { in: %w[csv xlsx] }
  validates :original_filename, presence: true, length: { maximum: 255 }

  scope :newest_first, -> { includes(response_file_attachment: :blob).order(created_at: :desc, id: :desc) }
end
