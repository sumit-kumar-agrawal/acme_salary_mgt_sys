ENV["RAILS_ENV"] ||= "test"
require_relative "../config/environment"
require "rails/test_help"

module ActiveSupport
  class TestCase
    # Parallel runs are off (BACKEND_PLAN.md K1): Rails 8.0's process workers are incompatible with
    # minitest 6 (workers die after the first test and the run hangs). Revisit after upgrading Rails.
    parallelize(workers: 1)

    # Setup all fixtures in test/fixtures/*.yml for all tests in alphabetical order.
    fixtures :all

    # FactoryBot for employees and salary records; fixtures hold reference data (BACKEND_PLAN.md J1).
    include FactoryBot::Syntax::Methods

    # Load the app's rake tasks once per test process (loading twice redefines constants and tasks).
    def self.load_rake_tasks_once
      return if defined?(@@rake_tasks_loaded)

      require "rake"
      Rails.application.load_tasks
      @@rake_tasks_loaded = true
    end

    # Uploaded CSV / XLSX files for bulk upload tests; rows include the header row.
    def csv_upload(rows, filename: "upload.csv", content: nil)
      uploaded_file(content || CSV.generate { |csv| rows.each { |row| csv << row } }, filename)
    end

    def xlsx_upload(rows, filename: "upload.xlsx")
      package = Axlsx::Package.new
      package.workbook.add_worksheet(name: "Sheet1") { |sheet| rows.each { |row| sheet.add_row row } }
      uploaded_file(package.to_stream.read, filename)
    end

    def uploaded_file(content, filename)
      file = Tempfile.new([ "upload", File.extname(filename) ], binmode: true)
      file.write(content)
      file.rewind
      Rack::Test::UploadedFile.new(file.path, "application/octet-stream", true, original_filename: filename)
    end

    # Parses a CSV or XLSX file produced by BulkUploadService into rows of strings.
    def read_result_file(content, format)
      if format == "xlsx"
        file = Tempfile.new([ "result", ".xlsx" ], binmode: true)
        file.write(content)
        file.close
        sheet = Roo::Excelx.new(file.path).sheet(0)
        (1..sheet.last_row).map { |index| sheet.row(index).map(&:to_s) }
      else
        CSV.parse(content.dup.force_encoding(Encoding::UTF_8).delete_prefix("﻿"))
      end
    end
  end
end

module ActionDispatch
  class IntegrationTest
    TEST_PASSWORD = "correct-horse-battery".freeze

    # The login rate limit counts in Rails.cache (memory store in test); start every test with a clean slate.
    setup { Rails.cache.clear }

    def sign_in(user = create(:user, password: TEST_PASSWORD), password: TEST_PASSWORD)
      post api_v1_session_path, params: { email: user.email, password: password }, as: :json
      assert_response :ok, "sign-in failed: #{response.body}"
      user
    end

    def json
      response.parsed_body
    end

    # Queries run by the block, excluding schema, transaction, and cached ones (N+1 checks compare two counts).
    def count_queries(&block)
      count = 0
      counter = ->(*, payload) { count += 1 unless payload[:name].in?([ "SCHEMA", "TRANSACTION" ]) || payload[:cached] }
      ActiveSupport::Notifications.subscribed(counter, "sql.active_record", &block)
      count
    end
  end
end
