import { useMutation } from "@tanstack/react-query";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import { isApiError, userMessage, type QueryParams } from "@/services/api";
import { reportService } from "@/services/reportService";

// CSV export of the salary report (FRONTEND_PLAN.md V11, G6; API §9.2). It sends the table's own query,
// so the file holds exactly the rows shown across all pages. The file is only held in memory while saving.

const FALLBACK_FILENAME = "salary-report.csv";

/** Saves a downloaded file through a temporary link (the only way a browser saves a fetched file). */
function saveFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoked after the click has been handled, so the download has its data.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function ExportCsvButton({ query }: { query: QueryParams }) {
  const exportCsv = useMutation({
    mutationFn: () => reportService.downloadCsv(query),
    onSuccess: ({ blob, filename }) =>
      saveFile(blob, filename ?? FALLBACK_FILENAME),
  });

  const tooLarge =
    isApiError(exportCsv.error) && exportCsv.error.code === "export_too_large";

  return (
    <div className="text-md-end">
      <Button
        variant="outline-primary"
        onClick={() => exportCsv.mutate()}
        disabled={exportCsv.isPending}
      >
        {exportCsv.isPending ? "Preparing CSV…" : "Export CSV"}
      </Button>
      {exportCsv.isError && (
        <Alert
          variant={tooLarge ? "warning" : "danger"}
          role="alert"
          className="mt-2 mb-0 text-start"
        >
          {userMessage(exportCsv.error)}
        </Alert>
      )}
    </div>
  );
}
