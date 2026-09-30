export interface BulkUpload {
  id: number;
  status: "process" | "completed" | "completed_with_errors";
  file_format: "csv" | "xlsx";
  original_filename: string;
  original_file_path: string;
  response_file_path: string | null;
  started_at: string;
  finished_at: string | null;
  created_at: string;
}
