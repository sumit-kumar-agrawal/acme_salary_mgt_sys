module Api
  module V1
    class BulkSalaryCorrectionsController < BaseController
      before_action :no_store, only: %i[original_file response_file]

      # GET: upload history, newest first.
      def index
        @bulk_imports = paginate(BulkSalaryCorrection.newest_first)
      end

      def show
        @bulk_import = find_bulk_import
      end

      # POST multipart `file`. A file that cannot be read or whose header does not match is rejected
      # with 422 before any row is processed; otherwise 201 with status and file links, even when some rows failed.
      def create
        file = params.require(:file)
        raise BadRequest.new(:file, "must be an uploaded file") unless file.respond_to?(:original_filename)

        @bulk_import = BulkUploadService.call(file: file, user: current_user)
        render :show, status: :created
      rescue BulkUploadService::HeaderMismatchError => e
        render_error(:unprocessable_entity, "invalid_file_header", e.message, details: e.details)
      rescue BulkUploadService::InvalidFileError => e
        render_error(:unprocessable_entity, "invalid_file", e.message)
      end

      def original_file
        send_attachment(find_bulk_import.original_file)
      end

      # 404 when no response CSV exists.
      def response_file
        send_attachment(find_bulk_import.response_file)
      end

      # GET ?file_format=csv|xlsx (default csv): the header row only.
      def template
        format = enum_param(:file_format, BulkUploadService::FORMATS.values) || "csv"
        file = BulkUploadService.template(format: format)
        send_data file[:io].read, type: file[:content_type], disposition: "attachment", filename: file[:filename]
      end

    private

      def find_bulk_import
        BulkSalaryCorrection.find(params[:id])
      end

      def send_attachment(attachment)
        return render_not_found unless attachment.attached?

        send_data attachment.download, type: attachment.content_type, disposition: "attachment",
          filename: attachment.filename.to_s
      end
    end
  end
end
