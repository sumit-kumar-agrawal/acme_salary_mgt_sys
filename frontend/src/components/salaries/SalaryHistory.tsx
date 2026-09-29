import { useState } from "react";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import DataTable, { type Column } from "@/components/common/DataTable";
import MoneyAmount from "@/components/common/MoneyAmount";
import SalaryChangeDialog from "@/components/salaries/SalaryChangeDialog";
import SalaryCorrectionDialog from "@/components/salaries/SalaryCorrectionDialog";
import SalaryStatusBadge from "@/components/salaries/SalaryStatusBadge";
import { useSalaryRecords } from "@/components/salaries/useSalaryRecords";
import type { SalaryRecord } from "@/services/salary.types";

// Salary history section of the employee page (FRONTEND_PLAN.md U2, U5, U6, U8). Newest first, as the API
// returns it. Each row shows its own currency; amounts are never totalled or compared across rows.

function historyColumns(
  onCorrect: (record: SalaryRecord) => void,
): Column<SalaryRecord>[] {
  return [
    {
      key: "from",
      header: "Effective from",
      cell: (record) => record.effective_from,
    },
    {
      key: "to",
      header: "Effective to",
      cell: (record) => record.effective_to ?? "—",
    },
    {
      key: "amount",
      header: "Monthly amount",
      cell: (record) => (
        <MoneyAmount
          amount={record.amount}
          currencyCode={record.currency_code}
        />
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (record) => <SalaryStatusBadge status={record.status} />,
    },
    {
      key: "actions",
      header: "Actions",
      // Only records the API marks editable (current and scheduled, D4 + O1) can be corrected.
      cell: (record) =>
        record.editable ? (
          <Button
            variant="outline-secondary"
            size="sm"
            aria-label={`Correct salary effective from ${record.effective_from}`}
            onClick={() => onCorrect(record)}
          >
            Correct
          </Button>
        ) : null,
    },
  ];
}

export default function SalaryHistory({ employeeId }: { employeeId: number }) {
  const history = useSalaryRecords(employeeId);
  const [changeOpen, setChangeOpen] = useState(false);
  const [correction, setCorrection] = useState<{
    record: SalaryRecord | null;
    show: boolean;
  }>({ record: null, show: false });
  const [notice, setNotice] = useState<string | null>(null);

  const records = history.data ?? [];
  const latest = records[0] ?? null;
  const defaultCurrency =
    records.find((record) => record.status === "current")?.currency_code ??
    latest?.currency_code ??
    "";

  const openCorrection = (record: SalaryRecord) => {
    setNotice(null);
    setCorrection({ record, show: true });
  };
  const closeCorrection = () =>
    setCorrection((current) => ({ ...current, show: false }));

  return (
    <section aria-labelledby="salary-history-heading" className="mt-4">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
        <h2 id="salary-history-heading" className="h5 mb-0">
          Salary history
        </h2>
        <Button
          variant="primary"
          size="sm"
          disabled={history.isPending || history.isError}
          onClick={() => {
            setNotice(null);
            setChangeOpen(true);
          }}
        >
          Record salary change
        </Button>
      </div>
      {notice && (
        <Alert variant="success" role="status">
          {notice}
        </Alert>
      )}
      <DataTable<SalaryRecord>
        caption="Salary history"
        columns={historyColumns(openCorrection)}
        rows={history.data}
        rowKey={(record) => record.id}
        isLoading={history.isPending}
        isFetching={history.isFetching && !history.isPending}
        error={history.isError ? history.error : undefined}
        onRetry={() => void history.refetch()}
        emptyMessage="No salary records yet."
      />
      <SalaryChangeDialog
        employeeId={employeeId}
        show={changeOpen}
        defaultCurrency={defaultCurrency}
        latestStart={latest?.effective_from ?? null}
        onHide={() => setChangeOpen(false)}
        onSaved={() => {
          setChangeOpen(false);
          setNotice("Salary change recorded.");
        }}
      />
      <SalaryCorrectionDialog
        employeeId={employeeId}
        record={correction.record}
        show={correction.show}
        onHide={closeCorrection}
        onSaved={() => {
          closeCorrection();
          setNotice("Salary record corrected.");
        }}
      />
    </section>
  );
}
