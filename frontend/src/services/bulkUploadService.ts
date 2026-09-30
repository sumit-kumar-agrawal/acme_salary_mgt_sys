import {
  apiDownload,
  apiRequest,
  ApiError,
  type DataEnvelope,
  type Paginated,
} from "@/services/api";
import type { BulkUpload } from "@/services/bulkUpload.types";

export function responseDownloadPath(path: string): string | null {
  return /^\/api\/v1\/bulk_salary_corrections\/\d+\/response_file$/.test(path)
    ? path
    : null;
}

export const bulkUploadService = {
  list: (page: number, perPage: number) =>
    apiRequest<Paginated<BulkUpload>>("/bulk_salary_corrections", {
      query: { page, per_page: perPage },
    }),
  upload: (file: File) => {
    const body = new FormData();
    body.append("file", file);
    return apiRequest<DataEnvelope<BulkUpload>>("/bulk_salary_corrections", {
      method: "POST",
      body,
    });
  },
  template: () => apiDownload("/bulk_salary_corrections/template"),
  downloadResponse: (path: string) => {
    if (!responseDownloadPath(path))
      throw new ApiError("The download link is invalid.", 400, "bad_request");
    return apiDownload(path.replace(/^\/api\/v1/, ""));
  },
};
