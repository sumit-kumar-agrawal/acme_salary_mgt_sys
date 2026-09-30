import { useRef, useState, type FormEvent } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import Alert from "react-bootstrap/Alert";
import Badge from "react-bootstrap/Badge";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import DataTable, { type Column } from "@/components/common/DataTable";
import ErrorAlert from "@/components/common/ErrorAlert";
import Pagination from "@/components/common/Pagination";
import SectionCard from "@/components/common/SectionCard";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { isApiError, type ApiDownload } from "@/services/api";
import type { BulkUpload } from "@/services/bulkUpload.types";
import {
  bulkUploadService,
  responseDownloadPath,
} from "@/services/bulkUploadService";

const STATUS_LABELS = {
  process: "Processing",
  completed: "Completed",
  completed_with_errors: "Completed with errors",
};

function saveFile({ blob, filename }: ApiDownload) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename ?? "salary-corrections.csv";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function BulkSalaryCorrectionsPage() {
  useDocumentTitle("Bulk salary corrections");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [file, setFile] = useState<File | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const client = useQueryClient();
  const history = useQuery({
    queryKey: ["bulk-salary-corrections", page, perPage],
    queryFn: () => bulkUploadService.list(page, perPage),
    placeholderData: keepPreviousData,
  });
  const upload = useMutation({
    mutationFn: bulkUploadService.upload,
    onSuccess: () => {
      setFile(null);
      if (input.current) input.current.value = "";
      setPage(1);
    },
    onSettled: () => {
      // A server error may occur after committing valid rows. Refresh all salary-dependent data.
      for (const key of [
        "bulk-salary-corrections",
        "employees",
        "analytics",
        "reports",
      ])
        void client.invalidateQueries({ queryKey: [key] });
    },
  });
  const download = useMutation({
    mutationFn: (path: string | null) =>
      path
        ? bulkUploadService.downloadResponse(path)
        : bulkUploadService.template(),
    onSuccess: saveFile,
  });
  const columns: Column<BulkUpload>[] = [
    {
      key: "filename",
      header: "Uploaded file",
      cell: (row) => row.original_filename,
    },
    {
      key: "uploaded",
      header: "Uploaded on (UTC)",
      cell: (row) => (
        <span className="text-nowrap">{row.created_at.slice(0, 10)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => (
        <Badge
          bg={
            row.status === "completed"
              ? "success"
              : row.status === "process"
                ? "secondary"
                : "warning"
          }
          text={row.status === "completed_with_errors" ? "dark" : undefined}
        >
          {STATUS_LABELS[row.status]}
        </Badge>
      ),
    },
    {
      key: "response",
      header: "Response file",
      cell: (row) => {
        const path =
          row.response_file_path &&
          responseDownloadPath(row.response_file_path);
        return path ? (
          <a
            href={path}
            className="btn btn-outline-primary btn-sm text-nowrap"
            onClick={(event) => {
              event.preventDefault();
              if (!download.isPending) download.mutate(path);
            }}
          >
            Download response CSV
          </a>
        ) : (
          "—"
        );
      },
    },
  ];
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (file && !upload.isPending) upload.mutate(file);
  }
  const details =
    isApiError(upload.error) && upload.error.code === "invalid_file_header"
      ? upload.error.details
      : undefined;

  return (
    <>
      <h1 className="h3 mb-1">Bulk salary corrections</h1>
      <p className="text-body-secondary mb-3">
        Correct existing salaries or create new scheduled salaries from a CSV or
        XLSX file.
      </p>
      <SectionCard
        title="Upload salary file"
        actions={
          <Button
            variant="outline-dark"
            size="sm"
            disabled={download.isPending}
            onClick={() => download.mutate(null)}
          >
            Download template
          </Button>
        }
      >
        <p className="text-body-secondary small">
          Start with the template. For new scheduled salaries, use future dates
          after the latest salary record and list dates in ascending order per
          employee.
        </p>
        <Form
          noValidate
          onSubmit={submit}
          className="mb-3"
          aria-label="Upload salary corrections"
        >
          <Form.Group controlId="bulk-salary-file" className="mb-3">
            <Form.Label>Salary corrections file</Form.Label>
            <Form.Control
              ref={input}
              type="file"
              accept=".csv,.xlsx"
              required
              disabled={upload.isPending}
              aria-describedby="bulk-file-help"
              onChange={(event) => {
                setFile((event.target as HTMLInputElement).files?.[0] ?? null);
                upload.reset();
              }}
            />
            <Form.Text id="bulk-file-help">
              Maximum 2 MB and 2,000 rows. Amounts are monthly and must include
              a currency code.
            </Form.Text>
          </Form.Group>
          <Button type="submit" disabled={!file || upload.isPending}>
            {upload.isPending ? "Processing…" : "Upload file"}
          </Button>
        </Form>
        {upload.isError && <ErrorAlert error={upload.error} />}
        {details && (
          <ul aria-label="Header errors">
            {Object.entries(details).map(([name, values]) => (
              <li key={name}>
                {name.replaceAll("_", " ")}: {values.join(", ")}
              </li>
            ))}
          </ul>
        )}
        {upload.data && (
          <Alert
            role="status"
            variant={
              upload.data.data.status === "completed" ? "success" : "warning"
            }
          >
            {STATUS_LABELS[upload.data.data.status]}
            {upload.data.data.response_file_path &&
              ". Download the response CSV from the history below."}
          </Alert>
        )}
        {download.isError && <ErrorAlert error={download.error} />}
      </SectionCard>
      <SectionCard title="Upload history" className="mb-0">
        <p className="small text-body-secondary">
          Valid rows are saved even when other rows fail. Download the response
          CSV, correct the error rows, and upload it again.
        </p>
        <DataTable
          caption="Bulk salary correction uploads"
          columns={columns}
          rows={history.data?.data}
          rowKey={(row) => row.id}
          isLoading={history.isPending}
          isFetching={history.isFetching}
          error={history.error}
          onRetry={() => void history.refetch()}
          emptyMessage="No bulk uploads yet."
        />
        {history.data && (
          <Pagination
            meta={history.data.meta}
            onPageChange={setPage}
            onPerPageChange={(value) => {
              setPerPage(value);
              setPage(1);
            }}
          />
        )}
      </SectionCard>
    </>
  );
}
