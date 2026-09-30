require "test_helper"

class BulkSalaryCorrectionTest < ActiveSupport::TestCase
  def build_import(**attributes)
    BulkSalaryCorrection.new(user: create(:user), file_format: "csv", original_filename: "june.csv", **attributes)
  end

  test "starts as process and accepts only the three statuses" do
    assert build_import.valid?
    assert_equal "process", build_import.status
    %w[process completed completed_with_errors].each { |status| assert build_import(status: status).valid? }
    %w[processing failed interrupted done].each { |status| assert_not build_import(status: status).valid? }
    import = build_import(file_format: "xls", original_filename: "")
    assert_not import.valid?
    assert_equal %i[file_format original_filename], import.errors.attribute_names
  end

  test "the database rejects an unknown status or format" do
    import = build_import.tap(&:save!)
    assert_raises(ActiveRecord::StatementInvalid) { import.update_columns(status: "failed") }
    assert_raises(ActiveRecord::StatementInvalid) { import.update_columns(file_format: "xls") }
  end

  test "response CSV is stored through Active Storage and counters are absent" do
    import = build_import.tap(&:save!)
    import.response_file.attach(io: StringIO.new("row_number,errors\n2,invalid\n"), filename: "response.csv", content_type: "text/csv")
    assert_equal "row_number,errors\n2,invalid\n", import.reload.response_file.download
    %w[total_rows created_rows updated_rows unchanged_rows failed_rows].each do |column|
      assert_not BulkSalaryCorrection.column_names.include?(column)
    end
  end

  test "newest_first orders by creation time, then id" do
    older = build_import.tap { |i| i.save! && i.update_columns(created_at: 2.days.ago) }
    first, second = Array.new(2) { build_import.tap(&:save!) }
    second.update_columns(created_at: first.created_at)
    assert_equal [ second, first, older ], BulkSalaryCorrection.newest_first.to_a
  end
end
