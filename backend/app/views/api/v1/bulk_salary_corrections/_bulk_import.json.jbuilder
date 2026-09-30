# One bulk upload: status and file links only, never row values. File paths point at the
# current controller's authenticated downloads; response_file_path is null without an attachment.
json.id bulk_import.id
json.status bulk_import.status
json.file_format bulk_import.file_format
json.original_filename bulk_import.original_filename
json.original_file_path url_for(action: :original_file, id: bulk_import.id, format: nil, only_path: true)
json.response_file_path(
  bulk_import.response_file_attachment ? url_for(action: :response_file, id: bulk_import.id, format: nil, only_path: true) : nil
)
json.started_at bulk_import.started_at
json.finished_at bulk_import.finished_at
json.created_at bulk_import.created_at
